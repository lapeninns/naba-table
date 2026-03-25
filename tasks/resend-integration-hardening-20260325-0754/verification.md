---
task: resend-integration-hardening
timestamp_utc: 2026-03-25T07:54:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Verification Report

## Manual QA — Chrome DevTools (MCP)

- Not applicable. This task changes server-side email infrastructure only and does not modify any UI route.

## Test Outcomes

- [x] `pnpm exec eslint lib/env.ts libs/resend.ts src/app/api/webhook/resend/route.ts server/emails/bookings.ts server/emails/invitations.ts server/auth/magic-link-email.ts`
- [x] `pnpm exec tsc --noEmit --pretty false`
- [x] `pnpm exec dotenv -e .env.local -- tsx scripts/email/check-resend-status.ts`

## Results

- Runtime sender default now normalizes to `no-reply@notifications.nabatable.com`.
- Shared Resend sends now support native `headers`, `tags`, `topicId`, and request idempotency keys.
- Suppressed recipients are blocked before provider delivery attempts.
- Webhook verification now uses Resend’s official Svix-backed verification flow with raw request bodies.
- Booking, invite, and magic-link senders now attach structured tags and stable idempotency keys.
- Deliverability audit still passes against live public DNS after the code hardening.

## Artifacts

- No new binary artifacts were generated for this server-side task.

## Known Issues

- [ ] No known issues from validation.

## Sign-off

- [x] Engineering
