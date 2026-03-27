---
task: hybrid-email-intents-and-cloudflare-cutover
timestamp_utc: 2026-03-27T08:53:42Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Hybrid Email Intent Ledger And Cloudflare Cutover

## Requirements

- Functional:
  - Replace the current Durable Object email scheduler dependency with a hybrid design suitable for Cloudflare Queues.
  - Preserve long-delay reminder scheduling and review-request scheduling.
  - Preserve operator visibility while changing the source of truth from queue internals to business-level email intent state.
  - Keep actual email dispatch rules and idempotency intact.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No secrets in source.
  - Preserve production email reliability.
  - Keep route payloads stable enough that the existing ops UI can be migrated without a disruptive rewrite.

## Existing Patterns & Reuse

- Existing send/dedupe logic already lives in:
  - `server/queue/email-processing.ts`
  - `server/emails/bookings.ts`
  - `server/emails/email-delivery-log.ts`
- Existing ops delivery analytics already use `email_delivery_log`.
- Existing queue monitor is isolated behind:
  - `src/app/api/ops/email-queue/route.ts`
  - `src/components/features/email-delivery/components/OpsEmailQueuePanel.tsx`

## Constraints & Risks

- Current delayed reminder flow may schedule jobs more than 24 hours before delivery.
- Existing production flow still depends on `FEATURE_EMAIL_QUEUE_ENABLED`.
- Queue visibility currently exposes transport-level statuses (`waiting`, `active`, `delayed`, `dlq`); the redesign should avoid leaving a second competing source of truth.
- DB changes must remain remote-first and migration-safe.

## Recommended Direction

- Add a DB-backed email intent ledger as the source of truth for future scheduled sends.
- Insert/update/cancel intents from booking side effects instead of scheduling directly in the Durable Object.
- Promote due intents into sendable work via the app cron path, while preserving shared send processing.
- Reframe the ops queue panel around intent lifecycle state rather than queue internals.
- Leave the old gateway transport code in place only as transitional compatibility until the ledger-backed flow is validated.
