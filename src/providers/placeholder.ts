/**
 * PLACEHOLDER provider. Returns canned data and does not call anything.
 *
 * It exists so the connector boots, serves /openapi.json and /llms.txt, and
 * can be pointed at by Muse while the real service is still being decided.
 * Replace with a provider for your own API when the surface is pinned down:
 *
 *   1. Fill in `providerCredential` handling (a per-connection upstream key).
 *   2. Implement the real methods on ProviderPort.
 *   3. Delete the three `demo*` methods and their operations.
 */
import {
  UpstreamError,
  type ConnectionRecord,
  type ProviderPort,
  type WhoAmI,
} from "../provider.js";

/** Simulated upstream work, so the async path can be exercised end to end. */
const JOBS = new Map<string, { id: string; status: string; startedAt: number; input: unknown }>();
/** Idempotency keys already seen, so a retry returns the same job. */
const IDEMPOTENCY = new Map<string, string>();
const READY_AFTER_MS = 5_000;

export function createPlaceholderProvider(opts?: {
  /** Override so tests need not wait. */
  readyAfterMs?: number;
}): ProviderPort {
  const readyAfter = opts?.readyAfterMs ?? READY_AFTER_MS;

  return {
    async whoami(connection: ConnectionRecord): Promise<WhoAmI> {
      return {
        connection_id: connection.id,
        status: connection.status,
        subject: connection.externalSubject,
        granted: ["whoami (placeholder — no business capabilities granted yet)"],
      };
    },

    // ── Demo scaffolding — delete with the demo operations ──────────
    async demoListThings(_connection, { limit }) {
      return {
        things: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
          id: `thing_${i + 1}`,
          name: `Placeholder item ${i + 1}`,
          note: "Replace with a real read operation.",
        })),
        count: Math.min(limit, 3),
        placeholder: true,
      };
    },

    async demoCreateJob(connection, input, idempotencyKey) {
      if (idempotencyKey) {
        const existing = IDEMPOTENCY.get(`${connection.id}:${idempotencyKey}`);
        if (existing) {
          const job = JOBS.get(existing)!;
          return { ...job, deduplicated: true };
        }
      }
      const id = `job_${Math.random().toString(36).slice(2, 10)}`;
      const job = {
        id,
        status: "pending",
        startedAt: Date.now(),
        input,
      };
      JOBS.set(id, job);
      if (idempotencyKey) IDEMPOTENCY.set(`${connection.id}:${idempotencyKey}`, id);
      return { id, status: job.status, note: "Placeholder job — no real work started." };
    },

    async demoGetJob(_connection, jobId) {
      const job = JOBS.get(jobId);
      if (!job) throw new UpstreamError(`no such job: ${jobId}`, 404);
      const done = Date.now() - job.startedAt >= readyAfter;
      return {
        id: job.id,
        status: done ? "succeeded" : "pending",
        result: done ? { placeholder_output: true } : null,
      };
    },
  };
}
