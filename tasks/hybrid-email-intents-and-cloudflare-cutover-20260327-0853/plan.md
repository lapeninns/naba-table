---
task: hybrid-email-intents-and-cloudflare-cutover
timestamp_utc: 2026-03-27T08:53:42Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Hybrid Email Intent Ledger And Cloudflare Cutover

## Objective

We will replace queue-managed delayed email scheduling with a ledger-backed intent model so long-delay reminders and review requests remain correct while the transport layer becomes replaceable with native Cloudflare Queues.

## Success Criteria

- [x] Delayed reminder and review-request scheduling writes to a DB-backed intent ledger.
- [x] Due intents can be promoted and processed through the existing email dispatch path.
- [x] Ops queue visibility is sourced from the new intent ledger rather than gateway internals.
- [x] Existing idempotent email send behavior remains intact.
- [x] The old Durable Object scheduler is no longer the canonical source of truth for delayed email state.

## Architecture & Components

- New server-side source of truth:
  - email intent ledger table + helper module
- Scheduling source:
  - `server/jobs/booking-side-effects.ts`
- Processing source:
  - `src/app/api/cron/process-emails/route.ts`
  - `server/queue/email-processing.ts`
- Operator visibility:
  - `src/app/api/ops/email-queue/route.ts`
  - `src/components/features/email-delivery/components/OpsEmailQueuePanel.tsx`
- Transitional transport:
  - existing gateway adapter may remain temporarily for now-ready work only

## Data Flow & API Contracts

- Booking lifecycle -> upsert/cancel email intent
- Cron -> list due intents -> process/send -> mark sent/skipped/failed
- Ops UI -> query ledger-backed statuses and booking enrichment

## Edge Cases

- Re-scheduling the same reminder/review intent after booking changes
- Cancelled or stale bookings that should skip instead of send
- Duplicate sends across retries or repeated cron runs
- Review-request jobs already tracked in `email_delivery_log`

## Testing Strategy

- Unit tests for intent ledger mapping and cron processing transitions
- Route tests for ledger-backed queue feed
- Focused tests around reminder/review scheduling and cancellation semantics

## Rollout

- Introduce ledger and dual-read the ops queue feed from it immediately.
- Switch scheduling writes to the ledger.
- Keep transport compatibility during the cutover, then remove the DO-only status dependency in a follow-up cleanup once stable.
- Current implementation status:
  - booking scheduling/cancellation, cron claiming, and admin/ops reads now use the ledger
  - `server/queue/email.ts` remains as a compatibility facade so existing callers do not need a second migration pass

## DB Change Plan (if applicable)

- Add a new public table for email intents and indexes for due-intent scans / restaurant views.
- No destructive change to `email_delivery_log`.
