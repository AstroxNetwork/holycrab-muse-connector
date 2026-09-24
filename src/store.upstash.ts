/**
 * KV over the Upstash REST protocol — no SDK dependency, works on Node,
 * Edge and Workers alike.
 *
 * Vercel KV is Upstash underneath, so one adapter covers both. Read the
 * credentials from whichever pair your platform provides:
 *
 *   Vercel KV   →  KV_REST_API_URL / KV_REST_API_TOKEN
 *   Upstash     →  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *
 * Values are passed as a command array over POST rather than embedded in
 * the URL path, so tokens and subjects containing `/`, `:` or unicode
 * survive intact.
 */
import type { KvNamespace } from "./store.kv.js";

type Command = (string | number)[];

export interface UpstashConfig {
  url: string;
  token: string;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
}

export function createUpstashKv(cfg: UpstashConfig): KvNamespace {
  const doFetch = cfg.fetchImpl ?? fetch;
  const base = cfg.url.replace(/\/$/, "");

  async function cmd(command: Command): Promise<unknown> {
    const res = await doFetch(base, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`kv ${command[0]} failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) throw new Error(`kv error: ${json.error}`);
    return json.result ?? null;
  }

  return {
    async get(key) {
      const out = await cmd(["GET", key]);
      return typeof out === "string" ? out : null;
    },
    async put(key, value, opts) {
      if (opts?.expirationTtl) {
        await cmd(["SET", key, value, "EX", opts.expirationTtl]);
      } else {
        await cmd(["SET", key, value]);
      }
    },
    async delete(key) {
      await cmd(["DEL", key]);
    },
  };
}

/** Build from the environment, or return undefined when nothing is configured. */
export function kvFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): KvNamespace | undefined {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  return createUpstashKv({ url, token, ...(fetchImpl ? { fetchImpl } : {}) });
}
