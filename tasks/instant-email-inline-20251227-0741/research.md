---
task: instant-email-inline
timestamp_utc: 2025-12-27T07:41:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Instant emails bypass queue

## Requirements

- Functional:
  - Treat these as instant: `request_received`, `confirmation`, `updated`, `cancelled`, `restaurant_cancellation`, `booking_rejected`.
  - Instant emails must send inline even when `ENABLE_EMAIL_QUEUE=true`.
  - Scheduled emails (`reminder_24h`, `reminder_short`, `review_request`) remain queued/scheduled.
  - Keep existing suppression envs (`SUPPRESS_EMAILS`, `LOAD_TEST_DISABLE_EMAILS`).
  - Update docs to reflect new behavior.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes; no a11y impacts.
  - Do not add secrets/config changes.
  - Keep changes minimal and localized.

## Existing Patterns & Reuse

- `server/jobs/booking-side-effects.ts` uses `isEmailQueueEnabled()` to decide queue vs inline for booking created/updated/cancelled.
- `scheduleReminderJob` and `scheduleReviewJob` already use queue for delayed sends.
- Email job types defined in `server/queue/email.ts`.
- Behavior documented in `docs/EMAIL_SYSTEM.md` (queue vs inline).

## External Resources

- None required (internal change only).

## Constraints & Risks

- Current auto-assign deferral for `request_received` only applies when queuing; bypassing the queue removes this delay.
- Inline sending could increase request-time work if side effects run synchronously.

## Open Questions (owner, due)

- None (scope confirmed by user).

## Recommended Direction (with rationale)

- Add an explicit instant-email allowlist and bypass the queue for those types even when the queue is enabled; keep reminders/review queued.
- Update docs so operators understand that the queue only governs scheduled emails after this change.
