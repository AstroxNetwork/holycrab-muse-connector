# Deploy

Same source, three targets. There is no platform-specific code in the core —
each target is a thin entry point that wires the same app.

## Vercel

```bash
npm i -g vercel
vercel link
vercel env add CONNECTOR_SECRET
vercel env add PUBLIC_URL        # https://muse.your-domain.com
vercel env add DASHBOARD_URL     # https://your-domain.com
vercel env add KV_REST_API_URL   # Vercel KV or Upstash
vercel env add KV_REST_API_TOKEN
vercel deploy --prod
```

`vercel.json` rewrites every path to `api/index.ts` so your public URLs stay at
the root. Muse must see `https://muse.your-domain.com/openapi.json`, not
`/api/openapi.json`.

::: tip One-click
There is a **Deploy with Vercel** button in the
[README](https://github.com/AstroxNetwork/muse-connector-template#readme). It
prompts for the three required variables during setup.
:::

## Cloudflare Workers

```bash
npm i -g wrangler
wrangler kv namespace create MUSE_KV   # then uncomment kv_namespaces in wrangler.jsonc
wrangler secret put CONNECTOR_SECRET
npm run deploy:cf
```

`wrangler.jsonc` sets `nodejs_compat`, which is **required** — token signing
uses `node:crypto`. Without the flag the Worker will not bundle.

The shipped config is deliberately minimal: no hardcoded resource ids and no
custom domain, so the one-click button works for anyone. Uncomment the `routes`
block once you control the domain.

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
The service logs a warning when the binding is missing, on purpose.
:::

| Store | How to enable |
|---|---|
| Cloudflare KV | bind `MUSE_KV` in `wrangler.jsonc` |
| Vercel KV / Upstash | set `KV_REST_API_URL` and `KV_REST_API_TOKEN` |
| Anything else | implement the four-method `ConnectionStore` interface |

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
a `*.workers.dev` URL while testing.

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
