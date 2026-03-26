---
task: fix-email-delivery-cron-regression
timestamp_utc: 2026-03-26T15:59:46Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Research: Restore Production Email Queue Drain

## Requirements

- Functional:
  - Restore production email delivery for transactional emails sent through Resend and queued through Cloudflare.
  - Ensure queued booking emails are drained automatically again through the canonical `/api/cron/process-emails` route.
  - Prevent future config regressions where the queue worker exists but is never scheduled.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI changes are expected.
  - Do not add alternate delivery paths that bypass queue idempotency and observability.
  - Do not expose Resend, Cloudflare, or cron secrets in code or logs.

## Existing Patterns & Reuse

- Canonical enqueue path:
  - `server/jobs/booking-side-effects.ts`
  - `server/queue/email.ts`
- Canonical drain + dispatch path:
  - `src/app/api/cron/process-emails/route.ts`
  - `server/queue/email-processing.ts`
  - `server/emails/bookings.ts`
  - `libs/resend.ts`
- Manual/ops drain helpers:
  - `scripts/queues/email-worker.ts`
  - `scripts/queues/drain-review-request-jobs.ts`
- Deployment scheduler source of truth:
  - `vercel.json`

## External Resources

- None required; repository code and git history were sufficient to confirm the regression.

## Constraints & Risks

- With `FEATURE_EMAIL_QUEUE_ENABLED=true`, removing the drain schedule stops all queued email delivery, not just review emails.
- The issue is operationally severe because enqueueing may still succeed, making the failure look like a sender problem.
- A config-only fix can regress again unless we add a test or validation around required cron routes.

## Findings

- The repo uses Resend for outbound email sending and Cloudflare as the email queue gateway.
- `src/app/api/cron/process-emails/route.ts` still exists and is the canonical drain endpoint for queued emails.
- `scripts/queues/email-worker.ts` still expects `/api/cron/process-emails` to exist and be callable with `CRON_SECRET`.
- Current `vercel.json` schedules only `/api/cron/auto-complete-bookings`.
- Git history shows the missing schedule existed before commit `fc01dfdc`:
  - `git show fc01dfdc^:vercel.json` includes `/api/cron/process-emails` on `*/5 * * * *`
  - `git show fc01dfdc:vercel.json` removes it while keeping the rest of the queue stack intact
- Conclusion: production email delivery regressed because queued emails no longer have an automated drain trigger.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Restore the `/api/cron/process-emails` schedule in `vercel.json` using the prior cadence (`*/5 * * * *`) because the rest of the codebase still depends on that route.
- Add a focused regression test that asserts required cron routes are present in `vercel.json` so future infra edits cannot silently disable queue draining.
