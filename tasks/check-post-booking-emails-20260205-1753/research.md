---
task: check-post-booking-emails
timestamp_utc: 2026-02-05T17:53:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Post-Completion Guest Emails (Resend)

## Requirements

- Functional:
  - Identify whether review-request emails are sent after bookings transition to `completed` (manual check-out or auto-complete cron).
  - Verify Resend delivery status for those emails.
  - Restore reliable scheduling/sending if broken.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Avoid logging PII; only use masked emails or hashed identifiers in logs/artifacts.
  - No secrets in code/logs; use env configuration only.

## Existing Patterns & Reuse

- Auto-complete cron: `src/app/api/cron/auto-complete-bookings/route.ts` → `server/jobs/auto-complete-bookings.ts`.
- Check-out API: `src/app/api/ops/bookings/[id]/check-out/route.ts` → `enqueueCheckOutSideEffects`.
- Side effects: `server/jobs/booking-side-effects.ts` → `scheduleReviewJob` (review_request email).
- Email queue: `server/queue/email.ts` + worker `scripts/queues/email-worker.ts` + cron `src/app/api/cron/process-emails/route.ts`.
- Resend integration: `libs/resend.ts`.
- Env wiring: `config/env.schema.ts`, `lib/env.ts`, `server/feature-flags.ts`.

## External Resources

- Resend API docs (list emails / email status) — to be consulted before calling API.

## Constraints & Risks

- Production email delivery log table is not present in the production Supabase project backing `app.nabatable.com` (PostgREST schema cache error for `public.email_delivery_log`). The code path must tolerate missing logging/idempotency.
- Resend logs may be the only source for delivery verification.
- Queue relies on Redis; delayed jobs may be lost if eviction policy is not `noeviction`.
- If queue is enabled but enqueue fails and errors are swallowed, side-effects silently do not happen.

## Findings

- Root cause A (job creation gap): bookings were reaching `completed` without scheduling a `review_request` email job when completed via the deprecated status route `PATCH /api/ops/bookings/[id]/status` (it did not run the canonical check-out side effects).
- Root cause B (job processing starvation): the cron email processor historically scanned BullMQ delayed jobs newest-first, which can starve due jobs when many future-delayed jobs exist.
- Additional hardening needed: queue enqueues were swallowing errors, preventing fallback paths and hiding misconfiguration.

### Production Evidence (2026-02-05 UTC)

- Completed bookings in last 72 hours: `13`
- Completed bookings with a valid guest email: `12`
- Review-request jobs enqueued by backfill: `12` (jobId is per booking, so idempotent at queue level for the backfill run)
- Review-request cron drain after backfill: all `12` were processed (10 processed before final manual drain call; final manual drain processed 2)

## Open Questions (owner, due)

- Time window and environment to audit (prod, staging, preview)?
- Should we use Resend API with the environment key to list sent emails?
- Is the failure limited to auto-complete cron or also manual check-out?

## Recommended Direction (with rationale)

- Verify queue + cron health, then audit Resend delivery logs for review-request emails within a specified window.
- If missing, confirm whether jobs were created and processed; fix queue/cron/config or code path as needed.
