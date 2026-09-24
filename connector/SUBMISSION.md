# Muse directory submission kit

A checklist for `muse.ai/platform` → **Submit a connector**, and for Meta's
functional / security / legal review. Replace the `«placeholders»`.

> **On accuracy.** Meta's submission form is behind a login, so the field names
> below are a reconstruction from a developer's dated capture of the form, not
> an officially published schema. Treat them as a list of *what to have ready*
> and expect to adapt. The "Security review" section is your own material and is
> what actually matters.

---

## 0. Decide which path you want

| | **Custom Connector** | **Directory listing** |
|---|---|---|
| How | a user points Muse at your URL | submit this form |
| Review | **none** — Meta says so explicitly | functional + security + legal + end-to-end test |
| Distribution | none; users must know your URL | listed in Muse, eligible for featured placement |
| How fast | today | unknown; Meta publishes no SLA |

If you only want to validate, skip this document and do the Custom Connector
path first.

---

## 1. Describe your product

| Field | Notes |
|---|---|
| `productName` | «your product» |
| `companyName` | «your company» |
| `website` | must resolve |
| `useCases` | **example prompts, one per line** — what Muse uses to decide when to reach for you |
| `icon` | 512×512 PNG, under 256 KiB |
| `acceptsPayments` | whether the connector can take payment |
| `contactName` / `contactEmail` | a human Meta can reach |
| `support` | support URL |
| `privacyUrl`, `productTerms` | must resolve |
| `extraNotes` | anything a reviewer should know |

**`useCases` is the highest-leverage field.** Write phrases a person would
actually say, in their words. For a generation service that reads like:

```
Generate a 10 second video of a product on a rotating pedestal
Turn this image into a 5 second clip with camera movement
How many generation credits do I have left?
What did I generate yesterday?
```

---

## 2. Technical

| Field | Value |
|---|---|
| `connectionType` | `Raw API` (the form has also been seen offering `MCP` / `Existing MCP`) |
| `endpoint` | `«https://muse.your-domain.com»` |
| `openapi` | `«https://muse.your-domain.com»/openapi.json` |
| `documentationUrl` | `«https://muse.your-domain.com»/llms.txt` plus human docs |
| `authMethods` | Bearer connector token. OAuth optional. |
| `limits` | see below |

**`limits` — be specific.** Reviewers test this. Example:

> Read operations are free. Generation is metered: each job consumes credits
> from the user's balance. Per-connection rate limit 120 req/min; per-address
> 60 req/min. Jobs are idempotent via `Idempotency-Key`, so a retry cannot
> double-charge. The connector can start a generation and poll its status; it
> cannot move funds, change billing, or delete assets.

---

## 3. Review

Three attestations: that you are authorised to submit for the service, that you
accept the **Muse Connector Terms**, and that you understand distribution.

The Connector Terms are **only visible once signed in** — this is the document
behind the 401 at `muse.ai/platform/terms`. Read them properly before ticking
`termsAccepted`. They are the only place the commercial arrangement could be
specified, and Meta has published nothing about revenue share elsewhere.

---

## 4. Security review — answers to have ready

Fill this in with real answers. It doubles as a useful self-audit.

| Question | Answer |
|---|---|
| Authentication | Bearer connector token (`hcm_…`), HMAC-SHA256, names exactly one connection, 365-day expiry. Rotating `CONNECTOR_SECRET` invalidates all tokens. |
| What the credential can do | Only the operations in `/openapi.json`, scoped to that one connection. |
| What it cannot do | Read the user's upstream credential; act on another account; change billing; exceed the per-connection cap. |
| Revocation | User disconnects in the dashboard; connection status is re-checked on every request. |
| Upstream credentials | Server-side only. Never returned to Muse, never placed in a connector token. |
| Data minimisation | Responses carry only what the requested operation needs. |
| Transport | TLS only. |
| Abuse controls | Per-token and per-address rate limits; 64 KiB body cap; per-connection spend cap. |
| Idempotency | `Idempotency-Key` honoured on all spend operations. |
| Injection | `/llms.txt` instructs the assistant to read spend operations back and get an explicit yes/no for that specific request. |
| Secrets | Platform secret manager; never in the image or logs. |

---

## 5. End-to-end test plan (for Meta's testers)

Give reviewers a working account and a script. This is the fastest way through
review.

1. **Setup** — issue the reviewer a token. Expect Muse to acknowledge the connector.
2. `GET /v1/me` — reports the account and what was granted.
3. A free read operation — returns real data.
4. **A metered operation** — confirm Muse states the cost and waits for an
   explicit yes before starting it.
5. `GET` the job — reports `pending`, then `succeeded`. Polling does not create
   a second job.
6. **Retry the metered create with the same `Idempotency-Key`** — returns the
   same job, no second charge.
7. **Disconnect** — any further call returns `401`.
8. **Negative** — another account's token cannot read this account's data.

Automate 2–8 if you can; reviewers move faster on a script they can run.
