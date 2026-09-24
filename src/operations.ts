/**
 * The operation registry — the single place business capabilities are
 * declared. One `Operation` entry produces:
 *
 *   • the Hono route
 *   • the OpenAPI path (so Muse can learn it)
 *   • the `/llms.txt` line and its "rules for the assistant" notes
 *
 * Adding a capability later means adding one entry to
 * `operations.registry.ts` and one method to the provider. Nothing else.
 *
 * Descriptions written here are read by a model deciding whether to call
 * something, so they are written for it: say what the person would see, and
 * — just as important — what the call will NOT do.
 */
import type { ZodTypeAny } from "zod";
import type { ConnectionRecord, ProviderPort } from "./provider.js";

export interface OperationContext {
  connection: ConnectionRecord;
  provider: ProviderPort;
  /** Path parameters, e.g. `{ id: "job_123" }` for `/v1/jobs/{id}`. */
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  /** Set when the caller sent `Idempotency-Key`; pass through to the provider. */
  idempotencyKey?: string;
}

/**
 * Marks an operation that costs the person something. These are exactly the
 * calls that must not fire without a fresh, specific confirmation, and the
 * OpenAPI description says so in as many words.
 */
export interface SpendHint {
  kind: "credits" | "money" | "irreversible";
  /** One line a person would understand, e.g. "Costs 1 generation credit." */
  note: string;
}

/** An operation that returns a job to poll rather than a finished result. */
export interface AsyncHint {
  /** operationId of the read operation that reports progress. */
  pollWith: string;
  /** Rough wall-clock estimate, used to set expectations in prose. */
  typicalSeconds?: number;
}

export interface QueryParam {
  name: string;
  description: string;
  required?: boolean;
  schema: Record<string, unknown>;
}

export interface Operation {
  /** OpenAPI operationId. Stable — the model may cite it. */
  id: string;
  method: "get" | "post" | "delete";
  /** Path under the connector, e.g. "/v1/jobs/{id}". */
  path: string;
  /** One line, imperative, model-facing. */
  summary: string;
  /** A short paragraph. State the limit of what this call does. */
  description: string;
  /** Body operations only: validated in app.ts before the handler runs. */
  input?: { schema: ZodTypeAny };
  /**
   * Query operations: declared for the OpenAPI document and validated by the
   * handler (query strings are small and op-specific enough that a schema
   * per operation adds more ceremony than it removes).
   */
  queryParams?: QueryParam[];
  /** JSON Schema for the 200 response, for the OpenAPI document only. */
  outputSchema?: Record<string, unknown>;
  spends?: SpendHint;
  async?: AsyncHint;
  handler: (ctx: OperationContext) => Promise<unknown>;
}

export interface Registry {
  operations: Operation[];
  byId: Map<string, Operation>;
}

export function createRegistry(operations: Operation[]): Registry {
  const byId = new Map<string, Operation>();
  for (const op of operations) {
    if (byId.has(op.id)) throw new Error(`duplicate operationId: ${op.id}`);
    byId.set(op.id, op);
  }
  // A pollWith that points nowhere is a dead end for the model, and it is
  // exactly the kind of typo that only shows up in production. Fail loudly.
  for (const op of operations) {
    if (op.async && !byId.has(op.async.pollWith)) {
      throw new Error(
        `operation ${op.id} polls unknown operationId ${op.async.pollWith}`,
      );
    }
  }
  return { operations, byId };
}

/**
 * Turn an Operation into the prose Muse reads. Kept in one place so the
 * OpenAPI description and the llms.txt entry can never drift apart.
 */
export function describeForModel(op: Operation): string {
  const parts = [op.description];
  if (op.spends) parts.push(`COSTS THE PERSON: ${op.spends.note} Do not call this until they have agreed to this specific request.`);
  if (op.async) {
    const secs = op.async.typicalSeconds;
    parts.push(
      `This returns immediately with a job to track — poll \`${op.async.pollWith}\`${secs ? ` (typically ready in about ${secs}s)` : ""}. Do not resubmit to "check" progress; that would create a second job.`,
    );
  }
  return parts.join(" ");
}
