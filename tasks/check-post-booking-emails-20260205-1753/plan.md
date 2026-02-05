---
task: check-post-booking-emails
timestamp_utc: 2026-02-05T17:53:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Post-Completion Email Audit + Fix

## Objective

We will verify that review-request emails are sent after bookings reach `completed` and restore reliable delivery via Resend.

## Success Criteria

- [x] We can list review-request emails sent by Resend for a specified time window.
- [x] We can identify whether completed bookings lacked review emails (or confirm delivery).
- [x] If broken, queue/cron/config or code paths are fixed so review emails send reliably.
- [x] Backfill last 72 hours and trigger review-request sends without exposing guest PII.

## Architecture & Components

- `server/jobs/auto-complete-bookings.ts`: completes bookings and calls `enqueueCheckOutSideEffects`.
- `server/jobs/booking-side-effects.ts`: schedules `review_request` emails.
- `server/queue/email.ts`: queue creation/enqueue for scheduled emails.
- `scripts/queues/email-worker.ts` or `/api/cron/process-emails`: processes queued emails.
- `/api/cron/process-emails` will be extended to optionally filter by email `type` (e.g., `review_request`) for targeted processing.
- `libs/resend.ts`: Resend send call (no built-in delivery log).
- Deprecated completion route still in use: `src/app/api/ops/bookings/[id]/status/route.ts` must transition via canonical state machine and schedule check-out side effects.

## Data Flow & API Contracts

- Completion paths:
  - Auto-complete cron → `enqueueCheckOutSideEffects` → `scheduleReviewJob` → queue/job.
  - Manual check-out API → `enqueueCheckOutSideEffects` → `scheduleReviewJob` → queue/job.
- Email delivery:
  - Queue job (`review_request`) → worker/cron → `sendBookingReviewRequestEmail` → Resend API.
- Targeted processing (new):
  - GET `/api/cron/process-emails?types=review_request` (authorized) → only review jobs processed.

## UI/UX States

- N/A (no UI changes expected).

## Edge Cases

- Queue enabled but Redis misconfigured (jobs not created or lost).
- Cron not executing or unauthorized (CRON_SECRET mismatch).
- Review emails scheduled far in the future due to time calculations.
- Booking status not actually transitioned to `completed`.
- Subject templates customized (Resend audit by subject prefix may undercount).
- Immediate (delay=0) jobs must be processed (`wait` state) as well as due `delayed` jobs.

## Testing Strategy

- Audit queue counts and delayed jobs (admin endpoint or direct queue check).
- Resend API list for review-request subjects to confirm sends.
- If code changes: run targeted unit/flow tests for scheduling and side effects.

## Rollout

- No feature flag changes unless required to re-enable queue processing.
- If code fix, deploy with standard release and monitor queue + Resend logs.

## DB Change Plan (if applicable)

- N/A (unless we add delivery logging, then use Supabase MCP with staging-first).
