/**
 * The seams. Everything that depends on "what HolyCrab actually is" sits
 * behind these two ports, so the business can be filled in later without
 * touching the HTTP surface, the OpenAPI document, or the auth model.
 *
 *   ConnectionStore  — who has connected, and are they still connected?
 *   ProviderPort     — what the upstream service can actually do.
 *
 * Replace `providers/placeholder.ts` with a real provider (e.g.
 * `providers/your-service.ts`) when the API surface is decided. Nothing else
 * needs to change.
 */

/** One Muse user's link to HolyCrab. */
export interface ConnectionRecord {
  id: string;
  status: "connected" | "disconnected" | "pending";
  /** Stable id for the person on the provider side (email, user id, …). */
  externalSubject?: string;
  /** When the user connected; ISO-8601. */
  createdAt?: string;
  /**
   * Opaque provider credential for this connection, held server-side only.
   * NEVER returned to Muse and never put in a connector token.
   */
  providerCredential?: string;
  /** Free-form per-connection settings (spend cap, default model, …). */
  settings?: Record<string, unknown>;
}

export interface ConnectionStore {
  get(connectionId: string): Promise<ConnectionRecord | undefined>;
  /** Create or replace the connection for a subject. Returns the record. */
  upsert(
    subject: string,
    patch?: Partial<ConnectionRecord>,
  ): Promise<ConnectionRecord>;
  /** Revoke: every later request must fail. */
  disconnect(connectionId: string): Promise<boolean>;
  find(subject: string): Promise<ConnectionRecord | undefined>;
}

/**
 * The upstream service. Every method is a placeholder contract — rename,
 * add and remove freely as the real API is pinned down. The only rule the
 * rest of the connector relies on is: throw an `UpstreamError` to control
 * the HTTP status the caller sees.
 */
export interface ProviderPort {
  /** Identity + what this connection has been granted. Backs GET /v1/me. */
  whoami(connection: ConnectionRecord): Promise<WhoAmI>;

  /**
   * ── Add business capabilities below ─────────────────────────────────
   * Add one method per operation you declare in `operations.registry.ts`.
   * The shapes you will most likely want, as a checklist:
   *
   *   listThings(c, opts): Promise<Thing[]>
   *   getThing(c, id): Promise<Thing>
   *   estimate(c, input): Promise<Estimate>            // quote before spend
   *   createJob(c, input, idempotencyKey): Promise<Job> // spends money
   *   getJob(c, id): Promise<Job>                      // poll target
   *   cancelJob(c, id): Promise<Job>
   *   listJobs(c, opts): Promise<Job[]>
   * ───────────────────────────────────────────────────────────────────
   */

  /**
   * ── Placeholder scaffolding ────────────────────────────────────────
   * These three exist only so the skeleton is runnable end to end and the
   * async + metered patterns have a worked example. Delete them (and the
   * demo operations in `operations.registry.ts`) the moment a real
   * capability lands. They are optional so a real provider need not
   * implement them.
   */
  demoListThings?(
    connection: ConnectionRecord,
    opts: { limit: number },
  ): Promise<unknown>;
  demoCreateJob?(
    connection: ConnectionRecord,
    input: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<unknown>;
  demoGetJob?(connection: ConnectionRecord, jobId: string): Promise<unknown>;
}

export interface WhoAmI {
  connection_id: string;
  status: string;
  subject?: string;
  /** Human-readable summary of what Muse may do for this person. */
  granted?: string[];
  manage_url?: string;
}

/** Thrown by a provider to control the status the caller sees. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * In-memory ConnectionStore. Fine for local development and tests.
 *
 * NOT for production: it forgets every connection on restart, which silently
 * logs everyone out and — worse — makes revocation non-durable. Swap in a
 * real store (Postgres, KV, …) before you point Muse at it.
 */
export function createMemoryConnectionStore(): ConnectionStore {
  const byId = new Map<string, ConnectionRecord>();

  const newId = (): string =>
    `conn_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

  return {
    async get(connectionId) {
      return byId.get(connectionId);
    },
    async find(subject) {
      for (const rec of byId.values()) {
        if (rec.externalSubject === subject && rec.status !== "disconnected") {
          return rec;
        }
      }
      return undefined;
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
      byId.set(rec.id, rec);
      return rec;
    },
    async disconnect(connectionId) {
      const rec = byId.get(connectionId);
      if (!rec) return false;
      byId.set(connectionId, { ...rec, status: "disconnected" });
      return true;
    },
  };
}
