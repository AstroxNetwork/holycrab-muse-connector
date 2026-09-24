# Deploy

Three targets, one codebase. The core is a plain Hono app; each target is a thin
adapter around it, so nothing you write in `src/operations.registry.ts` or
`src/providers/` is platform-specific.

## Which one?

| | Vercel | Cloudflare Workers |
|---|---|---|
| Runtime | Node.js serverless function | V8 isolate |
| Entry point | `api/index.ts` (`hono/vercel`) | `src/worker.ts` (default export) |
| Routing | needs `vercel.json` to rewrite every path to `/api` | Worker owns every path natively |
| Cold start | Node function start | effectively none |
| `node:crypto` | native | **requires `nodejs_compat`** |
| Storage round trip | KV over REST — an extra network hop | KV binding, in-process |
| Config lives in | dashboard, or `vercel env` | `wrangler.jsonc` + `wrangler secret` |
| Local dev | `vercel dev` | `wrangler dev` |
| Custom domain | Vercel dashboard | `routes` in `wrangler.jsonc`, or dashboard |

**Pick Cloudflare if** you want the lowest latency, you already run your DNS
there, or you expect enough volume that per-request cost matters. The native KV
binding also saves a network hop on every authenticated request — which is every
request.

**Pick Vercel if** you want full Node compatibility, you are already on Vercel,
or you would rather debug a Node function than a Worker. Workers run a subset of
Node behind `nodejs_compat`; Vercel runs actual Node.

**Neither is a lock-in.** Both entry points are under 60 lines and only exist to
call `createApp()`. Moving between them is an afternoon.

## What's shared

```text
src/app.ts                 the HTTP surface          ─┐
src/operations.registry.ts your capabilities          ├─ identical everywhere
src/providers/             your service               ─┘
────────────────────────────────────────────────────────
api/index.ts               Vercel adapter
src/worker.ts              Cloudflare adapter
src/index.ts               Node / Docker adapter
```

## Vercel

### One-click

Use the **Deploy with Vercel** button on the [home page](/). It prompts for the
three required variables during setup.

### CLI

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET      # openssl rand -base64 48
vercel env add PUBLIC_URL            # https://muse.your-domain.com
vercel env add DASHBOARD_URL         # https://your-domain.com
vercel env add KV_REST_API_URL       # Vercel KV or Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` rewrites every path to `api/index.ts` so your public URLs stay at
the root. Muse must see `https://muse.your-domain.com/openapi.json`, not
`/api/openapi.json`. If you change the base path, check this first — a rewrite
that misses `/openapi.json` makes the connector invisible to Muse.

### Storage on Vercel

Vercel KV is Upstash underneath, so either works. The connector reads whichever
pair you provide:

- `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Vercel KV)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (Upstash directly)

The adapter speaks the REST protocol over `fetch`, so there is no SDK to install.

## Cloudflare Workers

### One-click

Use the **Deploy to Cloudflare** button on the [home page](/). It clones the repo
and deploys it; you supply `CONNECTOR_SECRET` and set the two URLs in
`wrangler.jsonc` (or as secrets).

### CLI

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # then uncomment kv_namespaces in wrangler.jsonc
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

### Things that bite on Workers

**`nodejs_compat` is required.** Token signing uses `node:crypto` for HMAC. The
flag is already set in `wrangler.jsonc`; without it the Worker will not bundle.

**`vars` in `wrangler.jsonc` are committed to the repo.** `PUBLIC_URL` and
`DASHBOARD_URL` live there because they are not secrets. `CONNECTOR_SECRET` is —
put it in `wrangler secret`, never in the file. Every fork that ships a real
secret in `vars` has published it.

**Add KV, or revocation stops working.** Without the binding the Worker keeps
connections in memory, and every isolate has its own. It logs a warning when the
binding is missing.

### Storage on Cloudflare

Bind a KV namespace as `MUSE_KV`. It is native — no REST hop, which makes every
authenticated request cheaper than the Vercel equivalent.

## Docker or any host

```bash
docker build -t muse-connector .
docker run -p 8787:8787 \
  -e CONNECTOR_SECRET=... \
  -e PUBLIC_URL=https://muse.your-domain.com \
  -e DASHBOARD_URL=https://your-domain.com \
  muse-connector
```

The image runs unprivileged and has a healthcheck against `/health`.

## Persistence — do this before real users {#persistence}

::: danger Without a store, connections live in memory
Locally that is fine. On serverless it is not: each request may land in a fresh
isolate, so users get logged out at random. Worse — a **revocation** only
reaches one isolate, which means disconnecting does not reliably disconnect.
:::

| Target | Store | How |
|---|---|---|
| Cloudflare | KV binding | bind `MUSE_KV` in `wrangler.jsonc` |
| Vercel | KV over REST | set `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Docker | KV over REST | same variables |
| Any | your own | implement the four-method `ConnectionStore` |

Switching is automatic: if KV is configured, it is used.

```ts
export interface ConnectionStore {
  get(connectionId: string): Promise<ConnectionRecord | undefined>;
  upsert(subject: string, patch?: Partial<ConnectionRecord>): Promise<ConnectionRecord>;
  disconnect(connectionId: string): Promise<boolean>;
  find(subject: string): Promise<ConnectionRecord | undefined>;
}
```

That is the whole interface. Postgres, DynamoDB, a file — your call.

## Do I need a subdomain? {#subdomain}

**No.** Any public HTTPS URL works: a subdomain, a path on your main domain, or
a `*.workers.dev` / `*.vercel.app` URL while testing.

A subdomain is still a good habit, for two concrete reasons:

1. Your main site probably already owns `/llms.txt` and `/openapi.json`. This
   connector needs both at its own root.
2. Your main site's WAF may treat non-browser API traffic as bot traffic. Muse
   calls from Meta's infrastructure.

## Environment reference

| Variable | Required | Notes |
|---|---|---|
| `CONNECTOR_SECRET` | yes | ≥32 chars, `openssl rand -base64 48`. Rotating invalidates all issued tokens |
| `PUBLIC_URL` | yes | The URL Muse calls. Goes in the OpenAPI `servers` entry |
| `DASHBOARD_URL` | yes | Where users review or revoke access |
| `SERVICE_NAME` | no | Default `Muse Connector` |
| `LINK_SECRET` | production | Guards `POST /v1/link` |
| `KV_REST_API_URL` / `_TOKEN` | production | Or `UPSTASH_REDIS_REST_*` |
| `PORT` | no | Default 8787 (Docker/Node only) |

`PUBLIC_URL` must be `https` unless it is localhost — Muse runs in a remote VM
and will not call plain http.
