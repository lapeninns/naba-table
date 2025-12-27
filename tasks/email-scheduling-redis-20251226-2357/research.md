---
task: email-scheduling-redis
timestamp_utc: 2025-12-26T23:57:10Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Redis-backed booking email scheduling

## Requirements

- Functional:
  - Schedule booking-related emails (pre-booking reminders, post-booking review requests).
  - Route all booking emails through the queue when `FEATURE_EMAIL_QUEUE_ENABLED=true`.
  - Use existing email provider (Resend).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Security: secrets only via env; do not log credentials.
  - Reliability: retries/backoff and DLQ for failed jobs.

## Existing Patterns & Reuse

- `server/jobs/booking-side-effects.ts` already schedules reminders/review requests and enqueues email jobs when `FEATURE_EMAIL_QUEUE_ENABLED` is on.
- `server/queue/email.ts` defines BullMQ queue + DLQ and enqueue/remove helpers.
- `lib/queue/redis.ts` resolves Redis connection from env (`QUEUE_REDIS_URL` or host/port).
- `libs/resend.ts` handles email sending.

## External Resources

- None required.

## Constraints & Risks

- No local Supabase; remote only (not applicable here).
- Secrets must not be committed; Redis URL must be supplied via env.
- Missing queue worker implementation (script exists in `package.json` but file is absent) — must add to process jobs.
- Worker requires long-lived process (confirmed available).

## Open Questions (owner, due)

- None (scope confirmed).

## Recommended Direction (with rationale)

- Implement a BullMQ email worker to process `pending-booking-email` jobs; keep reminder/review timing logic as-is.
- Route all booking emails through the queue when flag is enabled for consistent delivery and retries.
- Gate queue usage behind `FEATURE_EMAIL_QUEUE_ENABLED` so rollout can be controlled.
