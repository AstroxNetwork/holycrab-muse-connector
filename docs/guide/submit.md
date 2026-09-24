# Directory listing

Two different things, and the difference matters more than it first appears.

|  | Custom Connector | Directory listing |
|---|---|---|
| **How** | a user points Muse at your URL and supplies a token | submit a form at `muse.ai/platform` |
| **Review** | **none** — Meta says so explicitly | functional + security + legal + end-to-end test |
| **Distribution** | none; users must already know your URL | listed in Muse, eligible for featured placement |
| **Speed** | today | unknown; Meta publishes no SLA |
| **Terms** | none beyond the general ToS | you must accept the Muse Connector Terms |

## Start with Custom Connector

It needs nothing from Meta, so **validate first**. Point Muse at your deployment
and confirm it understands your async model before investing in a submission.
The things worth checking:

- Does Muse call your read operations when asked appropriate questions?
- On a paid operation, does it state the cost and wait for confirmation?
- Does it poll your job instead of resubmitting?
- Does a timeout make it poll again, rather than start a second job?

If any of those fail, the problem is almost always your `description` text, not
your code. Fix it in `src/operations.registry.ts` and check `/llms.txt` again.

## What Meta says, verbatim

From Meta's own help documentation on custom connectors:

> If you want to connect to a service not yet available in the Connector list,
> you can ask Muse to create a Custom Connector… Muse stores these in its Secure
> Credentials Store. **Meta doesn't review custom connectors** or how they use
> your information, so grant access with caution.

That last clause cuts both ways. There is no gate to pass — and no safety net
either. You own the consequences.

## Submitting for a listing

The submission process has three steps:

1. **Describe your product** — including example prompts, one per line. This is
   what Muse uses to decide when to reach for you.
2. **Review** — Meta checks functional, security and legal requirements and runs
   an end-to-end test.
3. **Appear in the directory** — users can find your connector; editors select
   featured placement separately.

There is a preparation checklist, including a security-review Q&A table and an
end-to-end test plan for Meta's reviewers, in
[`connector/SUBMISSION.md`](https://github.com/AstroxNetwork/muse-connector-template/blob/main/connector/SUBMISSION.md).

## Before you plan around it

Two things Meta has **not** published:

- **Revenue share and fees.** Nothing is disclosed. Treat the commercial model as
  unknown until you have read the Connector Terms, which are only visible once
  signed in.
- **Review time.** No SLA.

If your business case depends on either number, get it from the terms before
committing engineering time.
