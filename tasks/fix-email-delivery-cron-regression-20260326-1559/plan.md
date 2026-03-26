---
task: fix-email-delivery-cron-regression
timestamp_utc: 2026-03-26T15:59:46Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Restore Production Email Queue Drain

## Objective

We will restore the production email queue drain schedule so that Resend emails queued through Cloudflare are processed automatically again.

## Success Criteria

- [ ] `vercel.json` schedules `/api/cron/process-emails` again.
- [ ] The schedule uses the established `*/5 * * * *` cadence unless code evidence requires a different value.
- [ ] Regression coverage fails if the email drain cron is removed again.
- [ ] Focused verification passes without changing the sender or queue architecture.

## Architecture & Components

- `vercel.json`: Vercel cron scheduler source of truth.
- `src/app/api/cron/process-emails/route.ts`: authenticated queue drain endpoint.
- `server/queue/email-processing.ts`: dispatches queued jobs to booking email senders.
- `libs/resend.ts`: actual Resend send call.

## Data Flow & API Contracts

- Booking side effect enqueues Cloudflare job:
  - `booking-side-effects` -> `enqueueEmailJob` -> Cloudflare `/messages`
- Scheduled drain processes queue:
  - Vercel cron -> `GET /api/cron/process-emails` -> `triggerEmailQueueDrain` -> email dispatch -> Resend

## UI/UX States

- No UI changes planned.

## Edge Cases

- If production uses an external worker instead of Vercel cron, restoring the Vercel cron must still remain safe and idempotent.
- If the queue is disabled in some environments, the cron route exits cleanly with `"Email queue is disabled"`.
- If the Cloudflare gateway is misconfigured, the restored cron still surfaces an operational error instead of silently succeeding.

## Testing Strategy

- Add a config regression test for required cron routes in `vercel.json`.
- Run focused Vitest coverage for the new test.
- Run lint against touched files.

## Rollout

- Deployment target: application config only.
- Expected effect: production resumes draining queued emails after deploy.
- Monitoring:
  - Vercel cron logs for `/api/cron/process-emails`
  - queue status endpoint / ops email queue screen
  - downstream Resend delivery logs
- Kill-switch:
  - revert the `vercel.json` change if the cron causes unexpected load, though the previous schedule is known-good from git history

## DB Change Plan (if applicable)

- No database changes.
