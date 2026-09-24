# Quickstart

Five minutes to a running connector. You need Node 20 or later.

## 1. Clone and install

```bash
git clone https://github.com/AstroxNetwork/muse-connector-template.git my-connector
cd my-connector
npm install
```

## 2. Set three variables

```bash
cp .env.example .env

CONNECTOR_SECRET=$(openssl rand -base64 48)   # ≥32 chars
PUBLIC_URL=http://localhost:8787              # http is allowed for localhost
DASHBOARD_URL=https://example.com             # must be https
LINK_SECRET=dev-link-secret
```

::: warning These have no defaults on purpose
`PUBLIC_URL` becomes the OpenAPI `servers` entry — the address Muse is told to
call. `DASHBOARD_URL` is printed to users as the place to revoke access. A
default would mean a half-configured deploy points Muse, and your users, at the
wrong site. So the connector refuses to start instead. See
[Gotchas](/guide/gotchas).
:::

## 3. Run it

```bash
export $(grep -v '^#' .env | xargs)
npm run dev
```

It prints a warning about missing KV. That's expected locally — see
[Deploy](/guide/deploy#persistence).

## 4. Look at what Muse will see

```bash
curl -s localhost:8787/openapi.json | jq '.paths | keys'
# [ "/v1/me", "/v1/things", "/v1/jobs", "/v1/jobs/{id}" ]

curl -s localhost:8787/llms.txt
```

Those four operations are placeholders. Read the `llms.txt` output carefully:
**everything you write into an operation ends up in there**, and that text is
what the model uses to decide when to call you.

## 5. Mint a token and call the API

```bash
TOKEN=$(curl -s -X POST localhost:8787/v1/link \
  -H 'content-type: application/json' \
  -H 'x-link-secret: dev-link-secret' \
  -d '{"subject":"you@example.com"}' | jq -r .token)

curl -s localhost:8787/v1/me -H "Authorization: Bearer $TOKEN" | jq
```

## 6. Run the tests

```bash
npm test        # 50 tests
npm run typecheck
```

The tests are written as the specification. The one worth reading first is the
idempotency test — it asserts that retrying a paid operation returns the same
job rather than creating a second one.

## Where to go next

- **[Make it yours](/guide/build)** — declare your own capabilities.
- **[Async & paid work](/guide/async-and-paid)** — the part that actually
  needs care.
- **[Deploy](/guide/deploy)** — Vercel, Cloudflare, or Docker.
