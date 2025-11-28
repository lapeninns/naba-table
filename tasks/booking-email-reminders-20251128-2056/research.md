---
task: booking-email-reminders
timestamp_utc: 2025-11-28T20:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Pre- and Post-booking Emails

## Requirements

- Functional:
  - Pre-booking reminder email should be sent ahead of reservation time.
  - Post-booking review email should be sent after the reservation is completed.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Emails must avoid leaking PII beyond intended recipient; use existing template/localization approach.
  - Deliver reliably via existing mail provider; avoid rate limit issues.

## Existing Patterns & Reuse

- Emails are dispatched via `server/emails/bookings.ts` (CTA + reminder/review templates already exist).
- Booking side effects (`server/jobs/booking-side-effects.ts`) enqueue reminder (24h + short) and review-request jobs via BullMQ when `isEmailQueueEnabled()`.
- Worker at `scripts/queues/email-worker.ts` consumes `pending-booking-emails` queue and guards idempotency + status checks.

## External Resources

- N/A yet.

## Constraints & Risks

- Mis-timed emails could annoy users or reduce trust.
- Avoid duplicate sends and ensure idempotency if jobs retried.
- Feature flag defaults (`FEATURE_EMAIL_QUEUE_ENABLED` -> false) mean queue is off unless explicitly enabled; with queue off, reminder/review scheduling currently results in **no send** when the target time is in the future (delayMs>0) because the non-queue branch only sends when delay <= 0.

## Open Questions (owner, due)

- Are there existing cron/queue jobs for reservations? (owner: eng, due: ASAP)
- Are we expected to keep the queue disabled in some environments, or should we default it on? (owner: eng)

## Recommended Direction (with rationale)

- Keep existing queue pathway; add robust fallback when the queue flag is off so reminders/review requests still send (either inline or with lightweight timer) instead of silently skipping.
- Minimal change: extend `scheduleReminderJob`/`scheduleReviewJob` to execute send when queue is disabled and delay > 0 (e.g., setTimeout with logging) to prevent the current no-op.
