/**
 * The connector HTTP surface. Two audiences:
 *
 *   1. Muse, acting as a Custom Connector. It "retrieves API information
 *      from the service" (our `/openapi.json` + `/llms.txt`) and calls the
 *      `/v1/*` routes with the connector token the person pasted into Muse's
 *      Secure Credentials Store.
 *   2. Your own dashboard's "Connect Muse" page — `/v1/link`, which turns an
 *      authenticated person into a connection and mints their token.
 *
 * Nothing here holds business logic: routes, the OpenAPI document and
 * llms.txt are all projected from the operation registry.
 */
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual } from "node:crypto";
import { TOKEN_PREFIX, mintToken, verifyToken } from "./tokens.js";
import { createRateLimiter, type RateLimiter } from "./ratelimit.js";
import { openapiDocument, llmsTxt, type DocMeta } from "./openapi.js";
import type { Registry } from "./operations.js";
import { UpstreamError, type ConnectionStore, type ProviderPort } from "./provider.js";

export interface AppConfig {
  /** HMAC secret for connector tokens (≥32 chars). */
  connectorSecret: string;
  /** Where this connector is served, for the OpenAPI `servers` entry. */
  publicUrl: string;
  /** Where a person manages/revokes the connection. */
  dashboardUrl: string;
  /**
   * Shared secret your dashboard backend sends to `/v1/link`. The link
   * endpoint is server-to-server: the browser never sees this.
   */
  linkSecret?: string;
  meta: DocMeta;
  limits?: { perToken?: RateLimiter; perIp?: RateLimiter; link?: RateLimiter };
}

type Env = { Variables: { cid: string } };

export interface Deps {
  registry: Registry;
  store: ConnectionStore;
  provider: ProviderPort;
}

function problem(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 502,
  detail: string,
) {
  const titles: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    413: "Payload Too Large",
    422: "Unprocessable",
    429: "Too Many Requests",
    502: "Bad Gateway",
  };
  return c.json(
    { type: "about:blank", title: titles[status] ?? "Error", status, detail },
    status,
  );
}

/** Map a provider failure onto the caller's status. */
function upstream(c: Context, e: unknown) {
  if (e instanceof UpstreamError) {
    const allowed = [400, 401, 403, 404, 409, 422, 429, 502] as const;
    const status = (allowed as readonly number[]).includes(e.status)
      ? (e.status as (typeof allowed)[number])
      : 502;
    return problem(c, status, e.message);
  }
  const msg = e instanceof Error ? e.message : "upstream request failed";
  return problem(c, 502, msg);
}

/**
 * The caller's address. Behind a proxy, take the last hop we trust rather
 * than the first, which any client can forge.
 */
function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for") ?? "";
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? c.req.header("x-real-ip") ?? "unknown";
}

function bearer(c: Context): string | undefined {
  const h = c.req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || undefined;
}

export function createApp(cfg: AppConfig, deps: Deps): Hono<Env> {
  const app = new Hono<Env>();
  const { registry, store, provider } = deps;
  const limits = {
    perToken: cfg.limits?.perToken ?? createRateLimiter(120),
    perIp: cfg.limits?.perIp ?? createRateLimiter(60),
    link: cfg.limits?.link ?? createRateLimiter(10),
  };

  // ── Baseline response hygiene ──────────────────────────────────────
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
    if (c.req.path.startsWith("/v1/")) c.header("Cache-Control", "no-store");
  });
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) => problem(c, 413, "request body too large"),
    }),
  );
  // Per-IP ceiling on everything under /v1, bad tokens included, so a
  // scripted client cannot turn this into a token oracle.
  app.use("/v1/*", async (c, next) => {
    if (!limits.perIp.take(clientIp(c))) {
      return problem(c, 429, "too many requests from this address; slow down");
    }
    return next();
  });

  // ── Discovery (public) ─────────────────────────────────────────────
  // The service name comes from config, not a literal: this file is shared
  // by every deployment of the template.
  const serviceId = `${cfg.meta.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-muse-connector`;
  app.get("/health", (c) => c.json({ ok: true, service: serviceId }));
  app.get("/healthz", (c) => c.json({ ok: true, service: serviceId }));
  app.get("/openapi.json", (c) =>
    c.json(openapiDocument(cfg.publicUrl, registry, cfg.meta)),
  );
  const prose = () => llmsTxt(cfg.publicUrl, registry, cfg.meta);
  app.get("/llms.txt", (c) => c.text(prose()));
  app.get("/", (c) => c.text(prose()));

  // ── Link: your dashboard backend → a connection + token ────────────
  // Server-to-server only. Replace the body of this handler with your real
  // "user clicked Connect Muse" flow once the dashboard side exists.
  app.post("/v1/link", async (c) => {
    if (!limits.link.take(clientIp(c))) {
      return problem(c, 429, "too many link attempts; try again in a minute");
    }
    if (cfg.linkSecret) {
      const given = Buffer.from(c.req.header("x-link-secret") ?? "");
      const want = Buffer.from(cfg.linkSecret);
      if (given.length !== want.length || !timingSafeEqual(given, want)) {
        return problem(c, 403, "invalid link secret");
      }
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      subject?: unknown;
      provider_credential?: unknown;
    };
    if (typeof body.subject !== "string" || body.subject.length < 3) {
      return problem(c, 400, "subject is required");
    }
    const rec = await store.upsert(body.subject, {
      providerCredential:
        typeof body.provider_credential === "string"
          ? body.provider_credential
          : undefined,
    });
    const token = mintToken(cfg.connectorSecret, rec.id);
    return c.json({
      status: "linked",
      connection_id: rec.id,
      token,
      manage_url: cfg.dashboardUrl,
    });
  });

  // ── Auth for everything else under /v1 ─────────────────────────────
  app.use("/v1/*", async (c, next) => {
    if (c.req.path === "/v1/link") return next();
    const token = bearer(c);
    if (!token) {
      return problem(c, 401, `Authorization: Bearer ${TOKEN_PREFIX}… required`);
    }
    const v = verifyToken(cfg.connectorSecret, token);
    if (!v.ok) return problem(c, 401, `invalid connector token (${v.reason})`);
    if (!limits.perToken.take(v.payload.jti)) {
      return problem(c, 429, "too many requests for this connector token; slow down");
    }
    const conn = await store.get(v.payload.cid);
    if (!conn) {
      return problem(c, 401, "this connection no longer exists — reconnect Muse");
    }
    if (conn.status === "disconnected") {
      return problem(c, 401, `Muse was disconnected — reconnect at ${cfg.dashboardUrl}`);
    }
    c.set("cid", conn.id);
    return next();
  });

  // ── Registry-mounted operations ────────────────────────────────────
  for (const op of registry.operations) {
    const handler = async (c: Context) => {
      const connection = await store.get(c.get("cid") as string);
      if (!connection) return problem(c, 401, "connection not found");

      let body: unknown;
      if (op.input) {
        const raw = await c.req.json().catch(() => undefined);
        const parsed = op.input.schema.safeParse(raw);
        if (!parsed.success) {
          const detail = parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
          return problem(c, 400, detail || "invalid request body");
        }
        body = parsed.data;
      }

      try {
        return c.json(
          await op.handler({
            connection,
            provider,
            params: c.req.param() as Record<string, string>,
            query: new URL(c.req.url).searchParams,
            body,
            idempotencyKey: c.req.header("idempotency-key") ?? undefined,
          }),
        );
      } catch (e) {
        return upstream(c, e);
      }
    };

    // Operations are declared with OpenAPI path syntax (`/v1/jobs/{id}`);
    // Hono wants `/v1/jobs/:id`. Translate here so the registry stays in one
    // notation and the OpenAPI document needs no second pass.
    const path = op.path.replace(/\{([^}]+)\}/g, ":$1") as `/${string}`;
    if (op.method === "get") app.get(path, handler);
    else if (op.method === "post") app.post(path, handler);
    else app.delete(path, handler);
  }

  return app;
}
