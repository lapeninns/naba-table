---
task: resend-integration-hardening
timestamp_utc: 2026-03-25T07:54:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Resend Integration Hardening

## Objective

We will harden the production Resend integration so the canonical send and receive paths match the installed SDK and live deliverability posture.

## Success Criteria

- [ ] Default sender normalization points to `no-reply@notifications.nabatable.com`.
- [ ] Resend webhooks are verified using official Svix-backed signature verification.
- [ ] Shared email sends support native Resend `headers`, `tags`, `topicId`, and idempotency keys.
- [ ] Suppressed recipients are blocked at the shared send boundary.
- [ ] Current auth, booking, and invite senders attach stable idempotency keys and structured tags.
- [ ] Targeted lint/typecheck and the deliverability audit pass.

## Architecture & Components

- `lib/env.ts`: correct default sender-domain normalization.
- `libs/resend.ts`: canonical send contract, suppression gate, native Resend request options.
- `src/app/api/webhook/resend/route.ts`: verified webhook ingress and event normalization.
- `server/emails/bookings.ts`: booking email tags/idempotency and suppressed-recipient handling.
- `server/emails/invitations.ts`: invite email tags/idempotency and suppressed-recipient handling.
- `server/auth/magic-link-email.ts`: auth magic-link tags/idempotency.

## Data Flow & API Contracts

- Outbound:
  - Caller -> `sendEmail(...)` -> suppression check -> Resend SDK `emails.send(payload, { idempotencyKey })`
- Inbound:
  - Resend webhook -> `req.text()` raw body -> `resend.webhooks.verify(...)` -> normalized event handling -> suppression/logging

## UI/UX States

- Not applicable; no user-interface changes in scope.

## Edge Cases

- Missing Svix headers should return `401`.
- Invalid webhook signatures should return `401`, not `500`.
- Complaint events may arrive as `email.complained`; tolerate legacy `email.complaint` shape defensively.
- Suppressed recipients should short-circuit before any provider call.
- Attachment metadata should map to Resend’s `contentType` field.

## Testing Strategy

- Targeted ESLint on changed server/email files.
- Targeted TypeScript check for edited files where feasible.
- Run `pnpm exec dotenv -e .env.local -- tsx scripts/email/check-resend-status.ts`.

## Rollout

- No feature flag required; changes harden existing canonical infrastructure.
- Deploy normally and monitor Resend delivery events plus webhook processing logs.
- Kill-switch: revert the hardening patch if webhook verification or suppression gating causes unexpected production regressions.

## DB Change Plan (if applicable)

- No schema changes.
