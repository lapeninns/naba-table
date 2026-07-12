## Objective

Author and activate four implementation-ready Micro-Specs for consent v2, purpose-scoped review
redirects, a no-SMS review ledger, and production review delivery/release.

## Repo facts

- Existing WhatsApp v1 consent is lifecycle-only and phone-snapshot-bound.
- The mobile notification enum has four booking lifecycle events plus manager summary; review is absent.
- Review scheduling is currently email-gated in `server/jobs/booking-side-effects.ts`.
- `go.nabatable.com` is served by the existing booking-short-links Worker.
- Baseline `pnpm guard:micro-specs` and `pnpm test:micro-specs` passed before authoring.

## Assumptions and tradeoffs

- The existing venue review-request preference governs both review channels; email delivery remains independent.
- The five locked booking events exclude manager summary and reminders.
- Review failures are observable but never fall back to SMS.

## Constraints

- Governance authoring only; no product code, remote services, migrations, or production changes.
- Status transitions must be created by `pnpm governance:advance`.

## Risks

- Consent scope could be silently broadened for old records.
- A generic redirect could become an open redirect.
- Existing lifecycle fallback could leak into the review event.
- Partial provider configuration could produce a mixed production event set.

## Reuse notes

Reuse the versioned consent boundary, mobile ledger, signed Twilio callback, email review scheduler,
and booking-short-links Worker; do not create parallel infrastructure.

## Non-goals

Product implementation, provider submissions, remote DB work, deploys, or live smoke messages.

## Route/API identity

Not applicable to this governance-authoring task; later implementation specs identify the Worker
and callback surfaces but this task changes no route or handler.
