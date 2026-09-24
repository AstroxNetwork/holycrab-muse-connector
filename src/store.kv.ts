/**
 * A ConnectionStore that survives a serverless deploy.
 *
 * The in-memory store is fine locally, but on Vercel or Cloudflare every
 * request may land in a fresh isolate — connections would silently vanish
 * and, worse, revocation would stop being durable. So production needs a
 * shared store.
 *
 * This adapter speaks the least common denominator of every KV people
 * actually deploy with, which keeps the connector portable:
 *
 *   Cloudflare KV   →  env.MUSE_KV                     (bind directly)
 *   Vercel KV       →  thin wrapper over @vercel/kv
 *   Upstash Redis   →  thin wrapper over @upstash/redis
 *
 * Only `get`/`put`/`delete` are required; `list` is optional and only used
 * by `find()` (the link flow's "do they already have a connection?" check).
 * Without it, callers fall back to keying by subject directly, which this
 * adapter does anyway — see below.
 */
import type {
  ConnectionRecord,
  ConnectionStore,
} from "./provider.js";

export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    opts?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

const recKey = (id: string) => `conn:${id}`;
const subjKey = (subject: string) => `subj:${subject}`;

/**
 * Subject keys must be opaque and filesystem/KV-safe: they can contain `@`,
 * `:` and unicode. Hashing keeps the key bounded and avoids leaking the
 * person's address into a key listing.
 */
async function subjectKey(subject: string): Promise<string> {
  const bytes = new TextEncoder().encode(subject.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return subjKey(hex);
}

export function createKvConnectionStore(kv: KvNamespace): ConnectionStore {
  const newId = (): string =>
    `conn_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  return {
    async get(connectionId) {
      const raw = await kv.get(recKey(connectionId));
      return raw ? (JSON.parse(raw) as ConnectionRecord) : undefined;
    },

    async find(subject) {
      const id = await kv.get(await subjectKey(subject));
      if (!id) return undefined;
      const rec = await this.get(id);
      return rec && rec.status !== "disconnected" ? rec : undefined;
    },

    async upsert(subject, patch = {}) {
      const existing = await this.find(subject);
      const rec: ConnectionRecord = {
        id: existing?.id ?? newId(),
        status: "connected",
        externalSubject: subject,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        ...existing,
        ...patch,
      };
      await kv.put(recKey(rec.id), JSON.stringify(rec));
      // Index by subject so the link flow can find an existing connection
      // without a scan. Points at the id, not a copy of the record.
      await kv.put(await subjectKey(subject), rec.id);
      return rec;
    },

    async disconnect(connectionId) {
      const raw = await kv.get(recKey(connectionId));
      if (!raw) return false;
      const rec = JSON.parse(raw) as ConnectionRecord;
      await kv.put(
        recKey(connectionId),
        JSON.stringify({ ...rec, status: "disconnected" }),
      );
      return true;
    },
  };
}
