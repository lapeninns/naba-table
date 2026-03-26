---
task: fix-production-email-suppression-lookup
timestamp_utc: 2026-03-26T16:13:39Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- N/A (no UI changes planned).

## Test Outcomes

- `pnpm exec vitest run tests/server/recipient-suppression.test.ts --reporter=verbose`
  - Passed (2 tests)
- `pnpm exec eslint libs/resend.ts server/emails/recipient-suppression.ts src/app/api/webhook/resend/route.ts tests/server/recipient-suppression.test.ts`
  - Passed
- Live runtime diagnosis:
  - Resend sending domain is verified.
  - Cloudflare remains authoritative for DNS.
  - Vercel production env lists the queue gateway URL/token as configured.
  - Production queue failures point to `user_profiles.email` lookup against a schema where only `profiles.email` exists.
- Production rollout:
  - `origin/main` updated to `6c58ea13` (`fix: resolve email suppression lookups via profiles`)
  - Production deployment `https://nabatable-hv9ul7hmg-lapen-inns-projects.vercel.app` reached `Ready`
- Live queue recovery:
  - Replayed 3 failed jobs via `POST /api/cron/process-emails` on `https://app.nabatable.com`
    - Result: 2 sent, 1 skipped, 0 failed
  - Replayed remaining 10 failed jobs via `POST /api/cron/process-emails` on `https://app.nabatable.com`
    - Result: 7 sent, 3 skipped, 0 failed
- Live delivery validation:
  - Sent direct production test email to `amanshresthaaaaa@gmail.com` via Resend
  - Resend message id: `345743a5-38f1-4af2-8fa6-2c4916f735fc`
  - Resend status lookup returned `last_event: delivered`

## Artifacts

- Queue status evidence captured via authenticated runtime query.
- Resend deliverability audit captured via `scripts/email/check-resend-status.ts`.

## Known Issues

- Production currently has failed queued jobs blocked by the suppression lookup schema mismatch until this fix is deployed.

## Sign-off

- [ ] Engineering
- [ ] QA
