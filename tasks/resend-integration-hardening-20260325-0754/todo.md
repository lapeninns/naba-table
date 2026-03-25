---
task: resend-integration-hardening
timestamp_utc: 2026-03-25T07:54:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Re-audit the current Resend senders and webhook path.
- [x] Confirm installed `resend` SDK capabilities locally.

## Core

- [x] Correct the default Resend sender domain in runtime env normalization.
- [x] Extend the shared Resend helper with native payload/request options.
- [x] Enforce suppressed-recipient blocking in the canonical send path.
- [x] Replace placeholder webhook auth with official Resend verification.

## Senders

- [x] Add tags and idempotency keys to booking emails.
- [x] Add tags and idempotency keys to invite emails.
- [x] Add tags and idempotency keys to auth magic-link emails.

## Tests

- [x] Targeted lint
- [x] Targeted typecheck
- [x] Deliverability audit

## Notes

- Assumptions:
  - `user_profiles.email` remains the canonical suppression lookup field.
  - Current outbound emails are operational/auth messages, so no unsubscribe header is added yet.
- Deviations:
  - No dedicated automated unit test was added; validation used targeted lint/typecheck plus the existing deliverability audit.

## Batched Questions

- None at the moment.
