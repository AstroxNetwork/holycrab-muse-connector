/**
 * Everything Muse ingests about this connector, generated from the operation
 * registry so the two documents can never disagree with the routes.
 *
 * Muse "retrieves API information from the service" — these two files are
 * that retrieval. They are read by a model deciding when to call what, so
 * every string here is written for that reader: plain, concrete, and honest
 * about what a call will not do.
 */
import type { Operation, Registry } from "./operations.js";
import { describeForModel } from "./operations.js";
import { TOKEN_PREFIX } from "./tokens.js";

export interface DocMeta {
  title: string;
  version: string;
  /** One paragraph: who this is for and what the whole connector does. */
  description: string;
  /** Service name used in prose, e.g. "HolyCrab". */
  serviceName: string;
  /** Where a person manages/revokes the connection. */
  dashboardUrl: string;
}

/** Path parameters are declared from the `{name}` tokens in the path. */
function pathParams(op: Operation): Array<Record<string, unknown>> {
  const names = [...op.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  return names.map((name) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

const PROBLEM_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string" },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
  },
  required: ["title", "status"],
};

function operationObject(op: Operation): Record<string, unknown> {
  const parameters = [
    ...pathParams(op),
    ...(op.queryParams ?? []).map((p) => ({
      name: p.name,
      in: "query",
      required: p.required ?? false,
      description: p.description,
      schema: p.schema,
    })),
  ];

  const responses: Record<string, unknown> = {
    "200": {
      description: "Success",
      content: {
        "application/json": {
          schema: op.outputSchema ?? { type: "object", additionalProperties: true },
        },
      },
    },
    "401": { $ref: "#/components/responses/Unauthorized" },
  };
  if (op.spends) responses["409"] = { $ref: "#/components/responses/Conflict" };
  if (op.async) responses["429"] = { $ref: "#/components/responses/RateLimited" };

  const obj: Record<string, unknown> = {
    operationId: op.id,
    summary: op.summary,
    description: describeForModel(op),
    parameters,
    responses,
  };

  if (op.input) {
    obj.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: op.outputSchema ? { type: "object", additionalProperties: true } : { type: "object", additionalProperties: true },
        },
      },
    };
  }

  // Hints Muse's stack understands, and which a human reading the spec will
  // thank you for. Matches the convention long-running provider APIs use.
  if (op.async) {
    obj["x-long-running"] = true;
    obj["x-poll-operationId"] = op.async.pollWith;
    if (op.async.typicalSeconds) obj["x-typical-seconds"] = op.async.typicalSeconds;
  }
  if (op.spends) {
    obj["x-cost-kind"] = op.spends.kind;
    obj["x-cost-note"] = op.spends.note;
    obj["x-requires-confirmation"] = true;
  }
  if (op.method === "get") obj["x-idempotent"] = true;

  return obj;
}

export function openapiDocument(
  publicUrl: string,
  registry: Registry,
  meta: DocMeta,
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of registry.operations) {
    paths[op.path] ??= {};
    paths[op.path]![op.method] = operationObject(op);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: meta.title,
      version: meta.version,
      description: meta.description,
    },
    servers: [{ url: publicUrl }],
    security: [{ connectorToken: [] }],
    components: {
      securitySchemes: {
        connectorToken: {
          type: "http",
          scheme: "bearer",
          description:
            `The connector token from ${meta.serviceName} (starts with \`${TOKEN_PREFIX}\`). ` +
            `Revoke it any time at ${meta.dashboardUrl}.`,
        },
      },
      schemas: { Problem: PROBLEM_SCHEMA },
      responses: {
        Unauthorized: {
          description:
            "Missing, invalid, expired or revoked connector token. Ask the person to reconnect.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Problem" } } },
        },
        Conflict: {
          description: "The request contradicts current state (already done, already cancelled).",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Problem" } } },
        },
        RateLimited: {
          description: "Too many requests. Back off and retry; do not resubmit work.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Problem" } } },
        },
      },
    },
    paths,
    "x-errors": "Errors are RFC 9457 problem JSON.",
  };
}

/**
 * The prose half. Short, imperative, and explicit about the two failure modes
 * that actually cost people money: re-submitting paid work, and deciding
 * something on the model's own initiative.
 */
export function llmsTxt(
  publicUrl: string,
  registry: Registry,
  meta: DocMeta,
): string {
  const ops = registry.operations;

  const list = ops
    .map((op) => {
      const tags: string[] = [];
      if (op.spends) tags.push("**costs the person**");
      if (op.async) tags.push(`async — poll \`${op.async.pollWith}\``);
      const suffix = tags.length ? `  _(${tags.join("; ")})_` : "";
      return `- \`${op.method.toUpperCase()} ${op.path}\` — ${op.summary}${suffix}`;
    })
    .join("\n");

  const spendOps = ops.filter((o) => o.spends);
  const asyncOps = ops.filter((o) => o.async);

  const spendRules = spendOps.length
    ? `
## Spending the person's money
These operations cost something, so they need a fresh, specific agreement
every time — never a blanket "go ahead":

${spendOps.map((o) => `- \`${o.id}\` — ${o.spends!.note}`).join("\n")}

Before calling one: say what will be made, what it will cost, and wait for a
clear yes to *that*. A general "sounds good" earlier in the conversation is
not consent for a new charge.
`
    : "";

  const asyncRules = asyncOps.length
    ? `
## Waiting on work
${asyncOps.map((o) => `- \`${o.id}\` returns a job; poll \`${o.async!.pollWith}\`${o.async!.typicalSeconds ? ` (about ${o.async!.typicalSeconds}s)` : ""}.`).join("\n")}

Polling is free and safe. **Re-submitting is not** — it starts a second job.
A timeout is not a failure: keep polling the same job. If you lose the job id,
list existing jobs rather than creating a new one.
`
    : "";

  return `# ${meta.serviceName} for Muse

${meta.description}

## Setup (for the person, once)
1. Open ${meta.dashboardUrl} and create a connector token (starts with \`${TOKEN_PREFIX}\`).
2. Give that token to Muse when it asks for API credentials.
   Base URL: ${publicUrl}
3. Revoke it any time from the same page.

## API
OpenAPI: ${publicUrl}/openapi.json — Bearer token auth, JSON responses,
RFC 9457 problem+json errors.

${list}
${spendRules}${asyncRules}
## Rules for the assistant
- Only use the operations listed above. If asked for something that is not
  here, say so plainly instead of working around it.
- A 401 means the person revoked the token or it expired: ask them to make a
  new one at ${meta.dashboardUrl}.
- A 429 means slow down. Back off and retry the same call — do not start a
  new job to "get around" a rate limit.
- Quote the ids returned by this API back to the person; they are the handles
  for everything that follows.
`;
}
