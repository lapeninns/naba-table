---
task: booking-email-reminders
timestamp_utc: 2025-11-28T20:56:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Pre & Post Booking Emails

## Objective

Ensure reminder email is sent before reservation time and review email after completion so guests get timely notifications and feedback prompts.

## Success Criteria

- [ ] Pre-booking reminder email is enqueued and delivered at configured lead time for new reservations.
- [ ] Post-booking review email is enqueued/delivered after reservation completion.
- [ ] No duplicate emails for same reservation.

## Architecture & Components

- Scheduled job/queue for pre-booking reminders (existing or new cron worker).
- Scheduled job/queue for post-booking review emails.
- Email templates reused from existing mailer if present.
- Fallback path when `FEATURE_EMAIL_QUEUE_ENABLED` is false: inline scheduling (setTimeout) or immediate send so we don't no-op.

## Data Flow & API Contracts

- Booking creation/confirmation triggers `scheduleReminderJob` (24h + short) and `scheduleReviewJob` with computed delay.
- If queue enabled → enqueue BullMQ job with delay/idempotent jobId; worker sends based on booking status + prefs.
- If queue disabled → new fallback should send (or schedule in-process) instead of skipping when delay>0.

## UI/UX States

- N/A (backend emails), but logs/observability required.

## Edge Cases

- Canceled reservations should not receive emails.
- Timezone correctness for reservation datetime.
- Idempotent sends on retries.
- If queue disabled and process restarts before a setTimeout fires, email could be skipped; document limitation.

## Testing Strategy

- Unit/integration tests around job selection and fallback when queue disabled (mock timers and send function invocations).
- Manual verification via test reservations and mail sandbox if available.

## Rollout

- Feature flag not required if scoped by job schedule; can gate by env variable for lead/lag minutes.
- Monitor logs for send counts and errors for first day.
