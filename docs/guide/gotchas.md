# Gotchas

## Why are `PUBLIC_URL` and `DASHBOARD_URL` required?

They are not decoration, and they are not us being fussy about config.

- `PUBLIC_URL` becomes the OpenAPI `servers` entry — **the address Muse is told
  to call.**
- `DASHBOARD_URL` is printed to users in `llms.txt` and in every `401` — **the
  place you tell them to go and revoke access.**

A default would mean a half-configured deploy points Muse, and your users, at
somebody else's website. So the connector refuses to start and tells you why:

```text
[muse-connector] PUBLIC_URL is required — it is the address Muse is told to call,
and goes in the OpenAPI servers entry
```

Other rules the config enforces:

| Rule | Why |
|---|---|
| `CONNECTOR_SECRET` ≥32 chars | A short HMAC key is not worth using |
| URLs must be absolute | A relative value cannot go in `servers` |
| `https` required, except localhost | Muse runs in a remote VM and will not call plain http |
| Trailing slashes stripped | Otherwise concatenated paths break |

## Do I need a subdomain?

No. Any public HTTPS URL works. See
[Deploy → Do I need a subdomain?](/guide/deploy#subdomain).

## Does this need MCP?

No. Muse's custom connectors work over plain REST plus an OpenAPI document.

MCP is a different protocol, and it belongs to a different product: **Muse
Code**, Meta's terminal coding agent, does support MCP (via `mcpServers` in
`~/.config/muse/settings.json`). That is not this.

A lot of the confusion online comes from conflating the two.

## What if the model calls something at the wrong time?

Every call goes through Meta's permission layer, which can allow, deny, or ask
the user. You do not control that decision — you control how legible the request
is to it.

Three fields do that work:

- `summary` — one imperative line
- `description` — say what it does *and what it does not do*
- `spends` — say out loud that it costs money

## The connector works but Muse never calls it

Almost always one of:

1. **A vague `summary`.** The model matches user intent against your text. "Get
   jobs" is weaker than "Check the progress of a video generation that was
   already started."
2. **The operation is not in the registry.** Check
   `curl -s localhost:8787/openapi.json | jq '.paths | keys'`.
3. **The spec is not reachable.** Muse fetches `/openapi.json` from your
   `PUBLIC_URL`. Confirm it is publicly reachable over https — and that your WAF
   is not blocking non-browser traffic.

## Everything says 401

In order of likelihood:

1. The user revoked the connection, or it never existed in this store.
2. `CONNECTOR_SECRET` was rotated, which invalidates every token.
3. You are running a serverless deploy without KV, and the request landed on an
   isolate that has never seen that connection. This is the memory-store failure
   mode — see [Deploy](/guide/deploy#persistence).

## Can I use this without Muse at all?

Yes. It is an authenticated OpenAPI service with a token-minting endpoint. Point
any agent at it — that generality is deliberate.

## Is it really Apache-2.0?

Yes. Fork it, rename it, strip the branding. Keep the `NOTICE` file for the files
you redistribute. Your deployed service does not need to credit anyone.
