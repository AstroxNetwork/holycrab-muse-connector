# Muse Connector directory submission kit

What to have ready for `muse.ai/platform` → **Submit a connector**, and for
Meta's functional / security / legal review.

> **Note on accuracy.** Meta's submission form is behind a login, so the field
> names below are a reconstruction from a developer's dated capture of the form,
> not an official published schema. Treat them as a checklist of *what to have
> ready*, and expect to adapt. Everything in the "Security review" section is
> our own material and is what actually matters.

---

## 0. Before you submit

Being reachable as a **Custom Connector** needs nothing from Meta — any user can
point Muse at your `/openapi.json` and `/llms.txt` today. Submission is only for
the **directory**, which buys discovery and editorial placement in exchange for
review and unknown commercial terms.

---

## 1. Describe your product

| Field | Notes |
|---|---|
| `productName` | HolyCrab |
| `companyName` | AstroxNetwork |
| `website` | https://holycrab.ai |
| `useCases` | **example prompts, one per line** — this is what Muse uses to decide when to reach for you. See below. |
| `icon` | 512×512 PNG, under 256 KiB |
| `acceptsPayments` | whether the connector can take payment |
| `contactName` / `contactEmail` | a human Meta can reach |
| `support` | support URL |
| `privacyUrl`, `productTerms` | must resolve |

**`useCases` is the highest-leverage field.** Write the phrases a person would
actually say, in their words:

```
Generate a 10 second video of a product on a rotating pedestal
Turn this image into a 5 second clip with camera movement
Extend this video by 5 more seconds
How many generation credits do I have left?
What did I generate yesterday?
```

---

## 2. Technical

| Field | Value |
|---|---|
| `connectionType` | `Raw API` (also seen: `MCP` / `Existing MCP`) |
| `endpoint` | `https://muse.holycrab.ai` |
| `openapi` | `https://muse.holycrab.ai/openapi.json` |
| `documentationUrl` | `https://muse.holycrab.ai/llms.txt` (and the human docs) |
| `authMethods` | Bearer connector token (`hcm_…`). OAuth optional. |
| `limits` | see below |

**`limits` — be honest and specific.** Meta reviews this, and reviewers test it:

> Read operations are free and unlimited in practice. Generation is metered:
> each job consumes credits from the user's HolyCrab balance. Per-connection
> rate limit 120 req/min; per-address 60 req/min. Jobs are idempotent via
> `Idempotency-Key`. The connector is read-heavy: it can start a generation and
> poll its status, and cannot move funds, change billing, or delete assets.

---

## 3. Review

Three attestations are required: that you're authorised to submit on behalf of
the service, that you accept the **Muse Connector Terms** (only visible once
signed in — this is the document behind the 401 at `muse.ai/platform/terms`),
and that you understand how distribution works.

Read those terms properly before ticking `termsAccepted`. They are the only
place the commercial arrangement could be specified, and Meta has published
nothing about revenue share elsewhere.

---

## 4. Security review — answers to have ready

Fill this in with real answers. It is also a useful self-audit.

| Question | Answer |
|---|---|
| Authentication | Bearer connector token (`hcm_…`), HMAC-SHA256 signed, names exactly one connection, 365-day expiry. Rotating `CONNECTOR_SECRET` invalidates all tokens. |
| What the credential can do | Only the operations in `/openapi.json`, scoped to the one connection. |
| What it cannot do | Read the user's provider credential; act on any other account; change billing; exceed the per-connection cap. |
| Revocation | User disconnects in the dashboard; the connector re-checks connection status on every request. |
| Provider credentials | Held server-side only. Never returned to Muse, never placed in a connector token. |
| Data minimisation | Responses carry only what the requested operation needs. |
| Transport | TLS only. |
| Abuse controls | Per-token and per-address rate limits; body size cap (64 KiB); spend cap per connection. |
| Idempotency | `Idempotency-Key` honoured on all spend operations so a retry cannot double-charge. |
| Injection | `/llms.txt` instructs the assistant to read spend operations back and get an explicit yes/no for that specific request. |
| Transport of secrets | Secrets in the platform secret manager, never in the image or logs. |

---

## 5. End-to-end test plan (for Meta's testers)

Give reviewers a working account and a script. This is the fastest way through
review.

1. **Setup** — issue the reviewer a token from the dashboard. Expect Muse to
   acknowledge the connector.
2. `GET /v1/me` — reports the account and what was granted.
3. A free read operation — returns real data.
4. **A metered operation** — confirm Muse states the cost and waits for an
   explicit yes before starting it.
5. `GET` the job — reports `pending`, then `succeeded`. Polling does not create
   a second job.
6. **Retry the metered create with the same `Idempotency-Key`** — returns the
   same job, no second charge.
7. **Disconnect** in the dashboard — any further call returns `401`.
8. **Negative** — another account's token cannot read this account's data.

Automate 2–8 if you can; reviewers move faster on a script they can run.
