---
layout: home

hero:
  name: Muse Connector Template
  text: Build a Muse connector in an afternoon
  tagline: A deployable template for Meta Muse connectors. Per-connection tokens, async job scaffolding, and one registry that generates your routes, OpenAPI and llms.txt.
  actions:
    - theme: brand
      text: Start the quickstart
      link: /guide/quickstart
    - theme: alt
      text: What you're building
      link: /guide/getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/AstroxNetwork/muse-connector-template

features:
  - title: No app registration
    details: Building a Muse connector needs no app id and no review. You expose an HTTP API that Muse reads about and calls. A user can point Muse at your URL today.
  - title: The double-charge is already handled
    details: Generation is async and costs money. A retried "check progress" POST bills the user twice. The template wires the poll-don't-resubmit pattern into both the OpenAPI document and the prose Muse reads.
  - title: One registry, three outputs
    details: Declare a capability once and you get the route, the OpenAPI path, the llms.txt entry and the assistant's behavioural rules. They cannot drift apart.
  - title: Not locked in
    details: Deploy to Vercel, Cloudflare Workers or Docker. Storage is a four-method interface. No account, no API key, no telemetry from us. Apache-2.0.
  - title: Strict about the things that matter
    details: PUBLIC_URL and DASHBOARD_URL are required and validated, because they decide where Muse is told to call and where your users are sent to revoke access.
  - title: 50 tests as the spec
    details: Auth, token forgery, expiry, revocation, the async poll flow and idempotent retries are all covered. Read them if you want to know what "correct" looks like.
---
