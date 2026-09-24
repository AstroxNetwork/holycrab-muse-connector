import { describe, expect, it } from "vitest";
import { createKvConnectionStore, type KvNamespace } from "../store.kv.js";
import { createUpstashKv, kvFromEnv } from "../store.upstash.js";

/** Minimal in-memory KvNamespace, standing in for Cloudflare KV. */
function fakeKv(): KvNamespace & { dump: Map<string, string> } {
  const dump = new Map<string, string>();
  return {
    dump,
    async get(key) {
      return dump.get(key) ?? null;
    },
    async put(key, value) {
      dump.set(key, value);
    },
    async delete(key) {
      dump.delete(key);
    },
  };
}

describe("KV connection store", () => {
  it("round-trips a connection", async () => {
    const store = createKvConnectionStore(fakeKv());
    const rec = await store.upsert("a@b.co");
    expect(rec.id).toMatch(/^conn_/);
    const got = await store.get(rec.id);
    expect(got?.externalSubject).toBe("a@b.co");
    expect(got?.status).toBe("connected");
  });

  it("finds an existing connection by subject instead of duplicating it", async () => {
    const store = createKvConnectionStore(fakeKv());
    const first = await store.upsert("a@b.co");
    const second = await store.upsert("a@b.co", { settings: { cap: 5 } });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.settings).toEqual({ cap: 5 });
  });

  it("treats subjects case-insensitively and trims them", async () => {
    const store = createKvConnectionStore(fakeKv());
    const a = await store.upsert("Person@Example.com");
    const b = await store.upsert("  person@example.com  ");
    expect(b.id).toBe(a.id);
  });

  it("does not leak the subject into the key space", async () => {
    const kv = fakeKv();
    const store = createKvConnectionStore(kv);
    await store.upsert("person@example.com");
    const keys = [...kv.dump.keys()];
    expect(keys.some((k) => k.includes("person@example.com"))).toBe(false);
    expect(keys.some((k) => k.startsWith("subj:"))).toBe(true);
  });

  it("makes revocation durable — a disconnected connection stays gone", async () => {
    const kv = fakeKv();
    const store = createKvConnectionStore(kv);
    const rec = await store.upsert("a@b.co");
    expect(await store.disconnect(rec.id)).toBe(true);
    expect((await store.get(rec.id))?.status).toBe("disconnected");
    // And it must no longer be discoverable by subject, or the link flow
    // would hand the person a token for a dead connection.
    expect(await store.find("a@b.co")).toBeUndefined();
  });

  it("reports false when disconnecting something that never existed", async () => {
    const store = createKvConnectionStore(fakeKv());
    expect(await store.disconnect("conn_nope")).toBe(false);
  });
});

describe("Upstash / Vercel KV adapter", () => {
  const record = (result: unknown) =>
    new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("sends commands as a POSTed array so values need no escaping", async () => {
    const seen: unknown[] = [];
    const kv = createUpstashKv({
      url: "https://kv.example.com",
      token: "t",
      fetchImpl: async (_u, init) => {
        seen.push(JSON.parse(String(init?.body)));
        return record("OK");
      },
    });
    await kv.put("subj:abc", "conn_1");
    expect(seen[0]).toEqual(["SET", "subj:abc", "conn_1"]);
  });

  it("passes an expiry through when one is given", async () => {
    const seen: unknown[] = [];
    const kv = createUpstashKv({
      url: "https://kv.example.com",
      token: "t",
      fetchImpl: async (_u, init) => {
        seen.push(JSON.parse(String(init?.body)));
        return record("OK");
      },
    });
    await kv.put("k", "v", { expirationTtl: 60 });
    expect(seen[0]).toEqual(["SET", "k", "v", "EX", 60]);
  });

  it("returns null rather than throwing when a key is absent", async () => {
    const kv = createUpstashKv({
      url: "https://kv.example.com",
      token: "t",
      fetchImpl: async () => record(null),
    });
    expect(await kv.get("missing")).toBeNull();
  });

  it("surfaces a transport failure instead of pretending the write worked", async () => {
    const kv = createUpstashKv({
      url: "https://kv.example.com",
      token: "t",
      fetchImpl: async () => new Response("nope", { status: 500 }),
    });
    await expect(kv.put("k", "v")).rejects.toThrow(/kv SET failed/);
  });

  it("is undefined when the environment has no credentials", () => {
    expect(kvFromEnv({})).toBeUndefined();
    expect(kvFromEnv({ KV_REST_API_URL: "https://x" })).toBeUndefined();
    expect(
      kvFromEnv({ KV_REST_API_URL: "https://x", KV_REST_API_TOKEN: "t" }),
    ).toBeDefined();
  });

  it("also accepts the Upstash-native variable names", () => {
    expect(
      kvFromEnv({
        UPSTASH_REDIS_REST_URL: "https://x",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }),
    ).toBeDefined();
  });
});
