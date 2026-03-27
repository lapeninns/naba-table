---
task: hybrid-email-intents-and-cloudflare-cutover
timestamp_utc: 2026-03-27T08:53:42Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect existing email delivery log / queue feed types and hooks
- [x] Define the ledger schema and server API surface

## Core

- [x] Add email intent ledger migration and types
- [x] Add server helpers for create/update/cancel/list/promote intents
- [x] Switch booking side effects to use ledger scheduling
- [x] Update cron processing to work from due intents
- [x] Update ops queue/admin status sources to ledger-backed statuses

## UI/UX

- [x] Keep queue monitor data contract/statuses coherent with the ledger model without changing the panel surface

## Tests

- [ ] Server helpers
- [ ] Route tests
- [ ] Scheduling flow regression tests

## Notes

- Assumptions:
  - The existing ops queue panel can keep its current `waiting` / `active` / `delayed` / `dlq` buckets as a compatibility view over the ledger.
  - Native Cloudflare Queue transport can be introduced later without changing the new source-of-truth table or cron processor contract.
- Deviations:
  - `server/queue/email.ts` now fronts the ledger rather than the Durable Object email gateway so existing call sites keep working during the cutover.
  - No UI component changes were required; the route payloads stay compatible with the existing queue panel.

## Batched Questions

- None right now.
