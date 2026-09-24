/**
 * Vercel entry point (Node.js serverless function).
 *
 * `vercel.json` rewrites every path to this function so the connector's
 * public URLs stay at the root — Muse must see
 * https://muse.example.com/openapi.json, not /api/openapi.json.
 *
 * Deploy:
 *   vercel env add CONNECTOR_SECRET        # ≥32 chars
 *   vercel env add PUBLIC_URL              # https://muse.example.com
 *   vercel env add DASHBOARD_URL           # https://example.com
 *   vercel env add KV_REST_API_URL         # Vercel KV / Upstash
 *   vercel env add KV_REST_API_TOKEN
 *   vercel deploy --prod
 */
import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { ConfigError, buildAppConfig } from "../src/config.js";
import { createOperations } from "../src/operations.registry.js";
import { createMemoryConnectionStore } from "../src/provider.js";
import { createKvConnectionStore } from "../src/store.kv.js";
import { kvFromEnv } from "../src/store.upstash.js";
import { createPlaceholderProvider } from "../src/providers/placeholder.js";

export const config = { runtime: "nodejs" };

/** Inferred so the Vercel adapter sees the same Env as the app itself. */
type App = ReturnType<typeof createApp>;

function build(): App {
  // No fallbacks for PUBLIC_URL / DASHBOARD_URL: they are the address Muse is
  // told to call and the place users are sent to revoke access. A wrong
  // default would point both at the wrong site.
  const appConfig = buildAppConfig(process.env);

  // ── Swap these two lines when the real service lands ───────────────
  const kv = kvFromEnv();
  const store = kv ? createKvConnectionStore(kv) : createMemoryConnectionStore();
  const provider = createPlaceholderProvider();
  // ───────────────────────────────────────────────────────────────────

  if (!kv) {
    console.warn(
      "[muse-connector] no KV configured — connections are per-instance and " +
        "revocation is not durable. Set KV_REST_API_URL and KV_REST_API_TOKEN " +
        "before real use.",
    );
  }

  return createApp(appConfig, {
    registry: createOperations(provider),
    store,
    provider,
  });
}

// Built once per instance. A config error here surfaces as a 500 with the
// reason attached rather than a connector that silently misdirects Muse.
let app: App | undefined;
let configError: string | undefined;
try {
  app = build();
} catch (e) {
  configError = e instanceof ConfigError ? e.message : "invalid configuration";
  console.error(`[muse-connector] ${configError}`);
}

const handler = app ? handle(app) : undefined;

export default function (req: Request): Response | Promise<Response> {
  if (!handler) {
    return new Response(JSON.stringify({ error: configError }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return handler(req);
}
