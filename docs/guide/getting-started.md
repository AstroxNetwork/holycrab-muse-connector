# What you're building

Muse is Meta's personal AI agent. It reaches third-party services through
**connectors**.

The important part, and the part that surprises people: **there is no app to
register and no app id to collect.** Meta does not run your code. You expose an
HTTP API, and Muse reads a description of it and calls it on the user's behalf.

## Two files decide everything

Muse reads an OpenAPI document and an `llms.txt` from your service, then calls
your API.

| File | Who reads it | What it does |
|---|---|---|
| `/openapi.json` | the platform | Machine-readable: which operations exist, what they take, what they return |
| `/llms.txt` | the model | The same in prose, plus the rules — when to ask the person first, how to wait on slow work |

That's the whole integration surface. There is no SDK to install and no
callback to implement.

```text
Muse ──(connector token)──▶ your connector ──(your credential)──▶ your API
        scoped, revocable      this template       held server-side
```

## What the template gives you

Muse calls your API from Meta's infrastructure, acting for a person who is not
sitting there watching. Three things follow from that, and they are what this
template exists to handle:

1. **The model must not hold your API key.** Users get a token that names one
   connection. It is revocable, scoped, and carries no upstream secret. Your
   real credential stays server-side.
2. **Slow, paid work needs wording, not just code.** If the model retries a
   `POST` to "check progress", the person is charged twice. See
   [Async & paid work](/guide/async-and-paid).
3. **The description is the interface.** A model decides whether to call you
   based on prose you write. `"Reads your balance"` is weaker than
   `"Read-only. This cannot move funds."`

## What you get out of it

The output is a plain, authenticated OpenAPI service. Muse reads it — but so can
anything else that speaks OpenAPI: ChatGPT, Claude, Cursor, your own agent.

::: tip Not locked in
Nothing here is Muse-specific except some wording conventions in `llms.txt`, and
those are yours to change. There is no account with us, no key from us, and no
telemetry. Deploy it anywhere; delete the parts you don't want.
:::

## Next

- **[Quickstart](/guide/quickstart)** — running locally in five minutes.
- **[Make it yours](/guide/build)** — the three files you actually edit.
- Want to know whether this is worth it? The
  [Custom Connector path](/guide/submit) needs nothing from Meta, so you can
  validate before investing in anything.
