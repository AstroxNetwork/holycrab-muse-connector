# Muse Connector Template

**English** · [简体中文](README.zh-CN.md)

A deployable connector template for [Meta Muse](https://muse.ai). Fork it, rename
it, point it at your own service. Apache-2.0, no strings.

Muse is Meta's personal AI agent. It reaches third-party services through
**connectors**. Building one needs no app registration and no app id — you
expose an HTTP API that Muse can read about and call. This is that API, with the
parts that are easy to get wrong already done.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAstroxNetwork%2Fmuse-connector-template&env=CONNECTOR_SECRET&envDescription=At%20least%2032%20random%20characters.%20Signs%20the%20tokens%20users%20paste%20into%20Muse.&env=PUBLIC_URL&envDescription=The%20https%20URL%20you%20are%20deploying%20to.%20Muse%20is%20told%20to%20call%20this.&env=DASHBOARD_URL&envDescription=Where%20your%20users%20review%20or%20revoke%20access.&project-name=muse-connector&repository-name=muse-connector)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AstroxNetwork/muse-connector-template)

> **This deploys a working skeleton, not a finished connector.** The operations
> are placeholders. What you get is the auth model, the async-job plumbing, the
> OpenAPI/llms.txt generation and the deploy wiring — so adding a real
> capability becomes a small, local change.

---

## Not locked in

Worth stating plainly, because connector platforms usually are:

- **Deploy anywhere.** Vercel, Cloudflare Workers, Docker, a VPS, Fly, Railway.
  Same source, three adapters, no platform-specific code in the core.
- **Storage is a port, not a vendor.** In-memory, Cloudflare KV, or any
  Upstash-compatible REST endpoint. Implement the four-method `ConnectionStore`
  interface and use Postgres, DynamoDB, or a file if you prefer.
- **No account with us, no API key from us, no service to sign up for.**
  `CONNECTOR_SECRET` is a string you generate. There is nothing to call home and
  no telemetry.
- **The output is a plain OpenAPI service.** Muse reads it, but so can anything
  else that speaks OpenAPI — ChatGPT, Claude, Cursor, your own agent. Nothing
  here is Muse-specific except the prose conventions in `llms.txt`, and you can
  change those.
- **Fork freely.** Apache-2.0. Rename the package, delete the branding, keep the
  `NOTICE` file. No attribution required on your deployed service.

What's already handled:

- **Per-connection tokens** — users never hand Muse your real API key.
- **Async job scaffolding** — the poll-don't-resubmit pattern, wired into both
  the OpenAPI document and the prose Muse reads.
- **Spend awareness** — metered operations are marked so Muse confirms with the
  person before spending their money.
- **One registry** — routes, `/openapi.json` and `/llms.txt` are all generated
  from a single list of operations, so they can't drift apart.
- **Strict config** — `PUBLIC_URL` and `DASHBOARD_URL` are required, because
  they decide where Muse is told to call and where your users are sent to revoke.

```
Muse ──(hcm_ token)──▶ muse.example.com ──(your credential)──▶ your API
        scoped, revocable    this connector        held server-side
```

---

## Quickstart

```bash
npm install
cp .env.example .env
# set CONNECTOR_SECRET (openssl rand -base64 48), PUBLIC_URL and DASHBOARD_URL
export $(grep -v '^#' .env | xargs)
npm run dev
```

See what Muse will see:

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
curl -s localhost:8787/llms.txt
```

Mint a token and make a call:

```bash
TOKEN=$(curl -s -X POST localhost:8787/v1/link \
  -H 'content-type: application/json' \
  -H "x-link-secret: $LINK_SECRET" \
  -d '{"subject":"you@example.com"}' | jq -r .token)

curl -s localhost:8787/v1/me -H "Authorization: Bearer $TOKEN" | jq
```

Run the tests — they double as the specification:

```bash
npm test        # 50 tests
npm run typecheck
```

---

## Deploy

### One-click

Use the buttons above. Both ask for `CONNECTOR_SECRET`, `PUBLIC_URL` and
`DASHBOARD_URL`.

### Vercel (CLI)

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET      # openssl rand -base64 48
vercel env add PUBLIC_URL            # https://muse.example.com
vercel env add DASHBOARD_URL         # https://example.com
vercel env add KV_REST_API_URL       # from Vercel KV (or Upstash)
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` rewrites every path to `api/index.ts` so public URLs stay at the
root — Muse must see `https://muse.example.com/openapi.json`, not
`/api/openapi.json`.

### Cloudflare Workers (CLI)

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # then uncomment kv_namespaces in wrangler.jsonc
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

`wrangler.jsonc` ships minimal on purpose — no hardcoded resource ids and no
custom domain — so the one-click button works for anyone. It sets
`nodejs_compat`, required because `tokens.ts` uses `node:crypto`.

### Docker

```bash
docker build -t muse-connector .
docker run -p 8787:8787 \
  -e CONNECTOR_SECRET=... \
  -e PUBLIC_URL=https://muse.example.com \
  -e DASHBOARD_URL=https://example.com \
  muse-connector
```

### ⚠️ Add a real store before real users

Without KV the connector keeps connections **in memory**. Locally that's fine.
On serverless it is not: each request may land in a fresh isolate, so people get
logged out at random and — worse — a revocation only reaches one isolate. The
Worker logs a warning when the binding is missing.

Set `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel KV or Upstash), or bind
`MUSE_KV` (Cloudflare KV), and it switches automatically.

---

## Make it yours

Three things to change. Everything else is plumbing.

### 1. The capabilities — `src/operations.registry.ts`

This is the file you edit. Delete the three `demo*` operations and add one
`Operation` per capability:

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

That one entry produces the route, the OpenAPI path, the `/llms.txt` line and
the "do not resubmit" warning — because `spends` and `async` are declared once.

### 2. The service — `src/providers/`

Implement `ProviderPort` against your real API.
`providers/placeholder.ts` shows the shape and is what you delete.

### 3. Naming

`SERVICE_NAME` drives the OpenAPI title, `/health` and `llms.txt`. The package
name and repo name are yours to change.

---

## The two rules that matter

Most of what makes a connector good or bad for Muse is not code.

### Never let it resubmit paid work

Generation is asynchronous and costs money. If Muse retries a `POST` to "check
progress", the person is charged twice. So:

- mark the create operation `async` and point `pollWith` at the read operation
- mark it `spends` so the description says so outright
- honour `Idempotency-Key` (the skeleton does — there's a test for it)

`/llms.txt` states this in as many words, and the OpenAPI carries
`x-long-running`, `x-poll-operationId` and `x-requires-confirmation`.

### Say what a call will *not* do

Descriptions are read by a model deciding whether to act. "Reads your balance"
is weaker than "Read-only. This cannot move funds." State the limit.

---

## Submitting to the Muse directory

Being reachable as a **Custom Connector** requires nothing from Meta — a user
can point Muse at your URL today. Getting listed in the **directory** is a
separate process with review; see [`connector/SUBMISSION.md`](connector/SUBMISSION.md).

Two things to know going in:

- Meta **does not review** Custom Connectors, and says so. You own the
  consequences.
- Meta has not published revenue share, fees, or a review SLA for directory
  listings.

---

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /health`, `/healthz` | none | liveness |
| `GET /openapi.json` | none | what Muse reads to learn the API |
| `GET /llms.txt`, `/` | none | the same, in prose |
| `POST /v1/link` | `x-link-secret` | your dashboard → a connection + token |
| `GET /v1/me` | connector token | who am I / what's granted |
| everything else | connector token | your operations |

Errors are RFC 9457 `problem+json`.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `CONNECTOR_SECRET` | yes | ≥32 chars. Rotating it invalidates all tokens. |
| `PUBLIC_URL` | yes | the URL Muse calls; goes in the OpenAPI `servers` entry |
| `DASHBOARD_URL` | yes | where users revoke access |
| `SERVICE_NAME` | no | default `Muse Connector` |
| `LINK_SECRET` | production | guards `POST /v1/link` |
| `KV_REST_API_URL` / `_TOKEN` | production | or `UPSTASH_REDIS_REST_*` |
| `PORT` | no | default 8787 (Docker/Node only) |

`PUBLIC_URL` and `DASHBOARD_URL` have no defaults by design. A default would
mean a half-configured deploy tells Muse to call — and sends users to — the
wrong site.

## License

Apache-2.0. Portions derived from [1Claw AI's muse-connector](https://github.com/1clawAI/muse-connector) —
see [`NOTICE`](NOTICE).
