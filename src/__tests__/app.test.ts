import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createOperations } from "../operations.registry.js";
import { createMemoryConnectionStore } from "../provider.js";
import { createPlaceholderProvider } from "../providers/placeholder.js";
import { TOKEN_PREFIX } from "../tokens.js";

const SECRET = "s".repeat(40);
const LINK_SECRET = "l".repeat(40);

function makeApp(opts?: { readyAfterMs?: number; linkSecret?: string }) {
  const store = createMemoryConnectionStore();
  const provider = createPlaceholderProvider({ readyAfterMs: opts?.readyAfterMs ?? 0 });
  const app = createApp(
    {
      connectorSecret: SECRET,
      publicUrl: "https://muse.example.com",
      dashboardUrl: "https://example.com",
      linkSecret: opts?.linkSecret ?? LINK_SECRET,
      meta: {
        title: "HolyCrab for Muse",
        version: "0.1.0",
        serviceName: "HolyCrab",
        dashboardUrl: "https://example.com",
        description: "Test description.",
      },
      // Generous limits so the tests exercise behaviour, not throttling.
      limits: undefined,
    },
    { registry: createOperations(provider), store, provider },
  );
  return { app, store, provider };
}

/** Link a subject and return their connector token. */
async function link(app: ReturnType<typeof makeApp>["app"], subject = "a@b.co") {
  const res = await app.request("/v1/link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-link-secret": LINK_SECRET },
    body: JSON.stringify({ subject }),
  });
  expect(res.status).toBe(200);
  const json = (await res.json()) as { token: string };
  return json.token;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("discovery endpoints", () => {
  it("serves health without auth", async () => {
    const { app } = makeApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });

  it("serves an OpenAPI document that describes the mounted routes", async () => {
    const { app } = makeApp();
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      servers: { url: string }[];
      paths: Record<string, Record<string, Record<string, unknown>>>;
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]!.url).toBe("https://muse.example.com");
    // Every registry operation must appear, or Muse cannot learn it.
    for (const path of ["/v1/me", "/v1/things", "/v1/jobs", "/v1/jobs/{id}"]) {
      expect(Object.keys(doc.paths)).toContain(path);
    }
    expect(doc.paths["/v1/me"]!.get!.operationId).toBe("whoAmI");
  });

  it("marks the metered async operation so Muse polls instead of resubmitting", async () => {
    const { app } = makeApp();
    const doc = (await (await app.request("/openapi.json")).json()) as any;
    const create = doc.paths["/v1/jobs"].post;
    expect(create["x-long-running"]).toBe(true);
    expect(create["x-poll-operationId"]).toBe("demoGetJob");
    expect(create["x-cost-kind"]).toBe("credits");
    expect(create["x-requires-confirmation"]).toBe(true);
    // And the prose the model reads must say it outright.
    expect(String(create.description)).toMatch(/COSTS THE PERSON/i);
    expect(String(create.description)).toMatch(/Do not resubmit/i);
  });

  it("declares path parameters for templated routes", async () => {
    const { app } = makeApp();
    const doc = (await (await app.request("/openapi.json")).json()) as any;
    const params = doc.paths["/v1/jobs/{id}"].get.parameters;
    expect(params).toContainEqual(
      expect.objectContaining({ name: "id", in: "path", required: true }),
    );
  });

  it("serves llms.txt with spend and polling rules derived from the registry", async () => {
    const { app } = makeApp();
    const res = await app.request("/llms.txt");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("HolyCrab for Muse");
    expect(text).toContain(TOKEN_PREFIX);
    expect(text).toContain("Spending the person's money");
    expect(text).toContain("Waiting on work");
    // The single most expensive mistake for a metered service.
    expect(text).toMatch(/Re-submitting is not/i);
  });
});

describe("auth", () => {
  it("rejects /v1/me without a token", async () => {
    const { app } = makeApp();
    expect((await app.request("/v1/me")).status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const { app } = makeApp();
    const res = await app.request("/v1/me", { headers: auth(`${TOKEN_PREFIX}bogus.sig`) });
    expect(res.status).toBe(401);
  });

  it("rejects a token whose connection was revoked", async () => {
    const { app, store } = makeApp();
    const token = await link(app);
    const me = (await (await app.request("/v1/me", { headers: auth(token) })).json()) as {
      connection_id: string;
    };
    await store.disconnect(me.connection_id);
    const res = await app.request("/v1/me", { headers: auth(token) });
    expect(res.status).toBe(401);
    expect(String(((await res.json()) as { detail: string }).detail)).toMatch(/reconnect/i);
  });

  it("requires the link secret to mint a token", async () => {
    const { app } = makeApp();
    const res = await app.request("/v1/link", {
      method: "POST",
      headers: { "content-type": "application/json", "x-link-secret": "wrong" },
      body: JSON.stringify({ subject: "a@b.co" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("linked flow", () => {
  it("answers whoAmI for the connection the token names", async () => {
    const { app } = makeApp();
    const token = await link(app, "person@example.com");
    const res = await app.request("/v1/me", { headers: auth(token) });
    expect(res.status).toBe(200);
    const me = (await res.json()) as { subject: string; status: string };
    expect(me.subject).toBe("person@example.com");
    expect(me.status).toBe("connected");
  });

  it("lists placeholder things and clamps the limit", async () => {
    const { app } = makeApp();
    const token = await link(app);
    const res = await app.request("/v1/things?limit=999", { headers: auth(token) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number };
    expect(json.count).toBeLessThanOrEqual(3);
  });
});

describe("metered async jobs", () => {
  it("creates a job, then reports it finished when polled", async () => {
    const { app } = makeApp({ readyAfterMs: 0 });
    const token = await link(app);

    const created = await app.request("/v1/jobs", {
      method: "POST",
      headers: { ...auth(token), "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(created.status).toBe(200);
    const job = (await created.json()) as { id: string; status: string };
    expect(job.id).toMatch(/^job_/);

    const polled = await app.request(`/v1/jobs/${job.id}`, { headers: auth(token) });
    expect(polled.status).toBe(200);
    expect(((await polled.json()) as { status: string }).status).toBe("succeeded");
  });

  it("reports pending while the job is still running", async () => {
    const { app } = makeApp({ readyAfterMs: 60_000 });
    const token = await link(app);
    const created = await app.request("/v1/jobs", {
      method: "POST",
      headers: { ...auth(token), "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    const job = (await created.json()) as { id: string };
    const polled = await app.request(`/v1/jobs/${job.id}`, { headers: auth(token) });
    expect(((await polled.json()) as { status: string }).status).toBe("pending");
  });

  it("returns the same job when the caller retries with an Idempotency-Key", async () => {
    const { app } = makeApp();
    const token = await link(app);
    const send = () =>
      app.request("/v1/jobs", {
        method: "POST",
        headers: {
          ...auth(token),
          "content-type": "application/json",
          "idempotency-key": "same-intent",
        },
        body: JSON.stringify({ prompt: "hello" }),
      });
    const first = (await (await send()).json()) as { id: string };
    const second = (await (await send()).json()) as { id: string; deduplicated?: boolean };
    expect(second.id).toBe(first.id);
    expect(second.deduplicated).toBe(true);
  });

  it("404s an unknown job instead of inventing one", async () => {
    const { app } = makeApp();
    const token = await link(app);
    const res = await app.request("/v1/jobs/job_nope", { headers: auth(token) });
    expect(res.status).toBe(404);
  });

  it("rejects a malformed body with a useful detail", async () => {
    const { app } = makeApp();
    const token = await link(app);
    const res = await app.request("/v1/jobs", {
      method: "POST",
      headers: { ...auth(token), "content-type": "application/json" },
      body: JSON.stringify({ prompt: "" }),
    });
    expect(res.status).toBe(400);
    expect(String(((await res.json()) as { detail: string }).detail)).toMatch(/prompt/);
  });
});
