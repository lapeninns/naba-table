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

## Artifacts

- Queue status evidence captured via authenticated runtime query.
- Resend deliverability audit captured via `scripts/email/check-resend-status.ts`.

## Known Issues

- Production currently has failed queued jobs blocked by the suppression lookup schema mismatch until this fix is deployed.

## Sign-off

- [ ] Engineering
- [ ] QA
