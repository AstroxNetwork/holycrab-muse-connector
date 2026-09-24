# Async & paid work

This is where connectors go wrong, and it is almost never a code problem. It is
a wording problem that turns into a billing problem.

Generation is asynchronous and costs the user money. If the model retries a
`POST` to "check progress", **the person is charged twice.**

::: danger The double-charge failure mode
A slow operation plus an eager model equals a duplicate charge. Three things
prevent it, and you need all three.
:::

| Defence | Where |
|---|---|
| Mark it `spends` so the description says it costs money | your operation |
| Mark it `async` with `pollWith` so the model polls instead of resubmitting | your operation |
| Honour `Idempotency-Key` so a retry returns the same job | your provider |

## Declare it once

```ts
spends: { kind: "credits", note: "Costs 1 generation credit." },
async: { pollWith: "getVideo", typicalSeconds: 90 },
```

## What that generates

The OpenAPI operation gains machine-readable hints:

```json
{
  "x-long-running": true,
  "x-poll-operationId": "getVideo",
  "x-typical-seconds": 90,
  "x-cost-kind": "credits",
  "x-cost-note": "Costs 1 generation credit.",
  "x-requires-confirmation": true
}
```

And the `description` the model reads becomes:

```text
COSTS THE PERSON: Costs 1 generation credit. Do not call this until they have
agreed to this specific request. This returns immediately with a job to track —
poll `getVideo` (typically ready in about 90s). Do not resubmit to "check"
progress; that would create a second job.
```

And `/llms.txt` grows a section the model reads every session:

```text
## Waiting on work
- `createVideo` returns a job; poll `getVideo` (about 90s).

Polling is free and safe. **Re-submitting is not** — it starts a second job.
A timeout is not a failure: keep polling the same job.
```

Plus, when any operation spends, a section headed **Spending the person's
money** that says a general "sounds good" earlier in the conversation is not
consent for a new charge.

## Honouring Idempotency-Key

The HTTP layer passes the header through as `idempotencyKey`. Your provider
decides what to do with it:

```ts
async createJob(connection, input, idempotencyKey) {
  if (idempotencyKey) {
    const existing = seen.get(`${connection.id}:${idempotencyKey}`);
    if (existing) return { ...existing, deduplicated: true };
  }
  // ... create, then record it against the key
}
```

`placeholder.ts` implements exactly this. The test suite asserts it:

```ts
const first  = await create({ "idempotency-key": "same-intent" });
const second = await create({ "idempotency-key": "same-intent" });
expect(second.id).toBe(first.id);   // not a second job
```

## Say what a call will *not* do

Descriptions are read by a model deciding whether to act.

| Weaker | Better |
|---|---|
| "Reads your balance" | "Read-only. This cannot move funds." |
| "Gets your tasks" | "Returns tasks. Does not create, edit or complete them." |
| "Manages your account" | "Lists connected accounts. Cannot change billing or delete anything." |

Stating the limit is what stops the model promising the user something your API
cannot do.

## Why polling is safe and resubmitting is not

Worth being explicit, because the model does not get to see your database:

- **Polling** is a `GET`. It reads state. Doing it ten times costs nothing.
- **Resubmitting** is a `POST`. It creates state. Doing it twice costs twice.

So the poll operation must be genuinely free and side-effect free — point
`pollWith` at a read, never at something that might kick off work.
