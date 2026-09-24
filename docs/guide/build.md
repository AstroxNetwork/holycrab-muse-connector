# Make it yours

Three things to change. Everything else is plumbing.

## 1. Declare your capabilities

Open `src/operations.registry.ts`. Delete the three `demo*` operations and add
one `Operation` per capability.

That single entry generates:

- the HTTP route
- the OpenAPI path
- the `/llms.txt` line
- the assistant's behavioural rules for it

```ts
{
  id: "createVideo",              // stable; the model may cite it
  method: "post",
  path: "/v1/videos",
  summary: "Generate a video from a prompt",
  description: "Starts a generation. Returns a job to track.",
  input: { schema: z.object({ prompt: z.string().min(1).max(4000) }) },
  spends: { kind: "credits", note: "Costs 1 generation credit." },
  async: { pollWith: "getVideo", typicalSeconds: 90 },
  handler: ({ provider, connection, body, idempotencyKey }) =>
    provider.createVideo(connection, body as any, idempotencyKey),
}
```

### The fields that matter

| Field | Why |
|---|---|
| `id` | `operationId`. Stable — the model may cite it, and `pollWith` refers to it |
| `summary` | One imperative line the model reads |
| `description` | A short paragraph. **State the limit of what it does not do** |
| `input` | Zod schema, validated before your handler runs |
| `spends` | Marks it as costing the person something |
| `async` | Marks it as returning a job, and names the operation to poll |
| `outputSchema` | JSON Schema for the 200 response, used in the OpenAPI document |

`spends` and `async` are covered in [Async & paid work](/guide/async-and-paid).
They are the difference between a connector that behaves and one that quietly
bills people twice.

## 2. Implement your service

Fill in `src/providers/` against your real API. Delete `placeholder.ts` when
you're done.

The port is deliberately tiny to start:

```ts
export interface ProviderPort {
  whoami(connection: ConnectionRecord): Promise<WhoAmI>;
  // add one method per operation you declared above
}
```

`placeholder.ts` is a worked example. It also demonstrates the idempotency
pattern — a map of `connection + Idempotency-Key` to job id, so a retry returns
the original job.

### Controlling the status the caller sees

Throw `UpstreamError` with a status. This is the only contract the rest of the
connector relies on:

```ts
import { UpstreamError } from "../provider.js";

throw new UpstreamError(`no such job: ${id}`, 404);
```

Mapped statuses pass through; anything unexpected becomes a `502`.

## 3. Name it

`SERVICE_NAME` drives the OpenAPI title, `/health` and `llms.txt`. It defaults
to `Muse Connector`.

The package name, bin name and repo name are yours. Rename them freely — nothing
depends on them.

## Checking your work

After editing, confirm the generated documents changed the way you expect:

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
curl -s localhost:8787/llms.txt
```

If an operation is missing from either, it is not in the registry. If it is in
the OpenAPI but the model would not know *when* to call it, your `description`
needs work — that text is the interface.
