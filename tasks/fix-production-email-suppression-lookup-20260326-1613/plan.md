---
task: fix-production-email-suppression-lookup
timestamp_utc: 2026-03-26T16:13:39Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Plan: Fix Production Email Suppression Lookup

## Objective

We will repair the production email suppression lookup so queued Resend emails can be delivered again through the Cloudflare-backed queue, while preserving suppression behavior for bounced and complained recipients.

## Success Criteria

- [ ] `sendEmail` no longer queries a nonexistent `user_profiles.email` column.
- [ ] Resend webhook suppression updates use the correct schema path.
- [ ] Focused tests cover the schema-safe suppression lookup behavior.
- [ ] After deploy, failed queued jobs can be retried successfully.
- [ ] A real validation email reaches `amanshresthaaaaa@gmail.com`.

## Architecture & Components

- `libs/resend.ts`
  - canonical recipient suppression check before send
- `src/app/api/webhook/resend/route.ts`
  - canonical suppression flag updates on bounce/complaint
- Optional helper
  - shared lookup that maps email -> profile ids via `profiles`

## Data Flow & API Contracts

- Send path:
  - recipient email -> normalize -> lookup matching `profiles.id` by `profiles.email`
  - matching ids -> lookup suppressed rows in `user_profiles`
  - suppressed recipients block send; others continue to Resend
- Webhook path:
  - bounced/complained recipient email -> resolve `profiles.id`
  - update `user_profiles.is_email_suppressed=true` for the matching id

## UI/UX States

- No UI changes planned.

## Edge Cases

- Email may exist in `profiles` but not `user_profiles`; that should not block send.
- Multiple matching profiles should be handled deterministically without false-positive suppression.
- Missing delivery-log table must not block retry or send if the sender itself succeeds.

## Testing Strategy

- Add focused tests around suppression resolution / resend webhook behavior.
- Re-run targeted Vitest coverage.
- Re-run lint on touched files.
- Run live production checks after deploy:
  - queue status
  - failed job retry / drain
  - direct validation send

## Rollout

- Deploy app code to production.
- Immediately check `/api/admin/queue-status`.
- Retry failed queue items or drain due jobs.
- Send a real validation email to `amanshresthaaaaa@gmail.com`.

## DB Change Plan (if applicable)

- No schema changes planned.
