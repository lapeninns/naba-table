---
task: instant-email-inline
timestamp_utc: 2025-12-27T07:41:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Instant emails bypass queue

## Objective

We will send instant booking emails inline even when the queue is enabled so that guests receive time-sensitive notifications immediately, while keeping scheduled reminders/reviews on the queue.

## Success Criteria

- [ ] Instant types (`request_received`, `confirmation`, `updated`, `cancelled`, `restaurant_cancellation`, `booking_rejected`) bypass the queue when `ENABLE_EMAIL_QUEUE=true`.
- [ ] Scheduled types (`reminder_24h`, `reminder_short`, `review_request`) still queue/schedule as before.
- [ ] Scheduled jobs enqueue without `jobId` colon errors.
- [ ] `docs/EMAIL_SYSTEM.md` reflects the new behavior.

## Architecture & Components

- `server/jobs/booking-side-effects.ts`: add an instant-type allowlist and route those sends inline regardless of queue flag.
- `server/queue/email.ts`: sanitize job IDs before enqueuing/removing jobs.
- `docs/EMAIL_SYSTEM.md`: clarify queue vs inline behavior post-change.

## Data Flow & API Contracts

- No API contract changes.
- Side-effect flow remains in `processBookingCreated/Updated/CancelledSideEffects`.

## UI/UX States

- Not applicable (no UI changes).

## Edge Cases

- Auto-assign deferral for `request_received` no longer applies when queue is enabled; email will send immediately.
- Queue-enabled deployments still rely on cron/worker only for scheduled types.
- Job IDs with `:` are rejected by BullMQ in this environment; sanitize in queue helper.

## Testing Strategy

- Unit: none currently in repo for this behavior.
- Integration: optional manual trigger via existing test endpoints (not required for this change).

## Rollout

- Feature flag: none (behavior change under existing `ENABLE_EMAIL_QUEUE`).
- Exposure: immediate.
- Monitoring: check email logs and queue metrics for scheduled jobs only.
- Kill-switch: `SUPPRESS_EMAILS` / `LOAD_TEST_DISABLE_EMAILS` to disable sending if needed.

## DB Change Plan (if applicable)

- Not applicable.
