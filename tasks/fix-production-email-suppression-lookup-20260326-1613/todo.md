---
task: fix-production-email-suppression-lookup
timestamp_utc: 2026-03-26T16:13:39Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: high
flags: [FEATURE_EMAIL_QUEUE_ENABLED]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Pull production env locally
- [x] Verify live Resend sending-domain health
- [x] Verify live queue failure reason

## Core

- [x] Fix suppression lookup in sender path
- [x] Fix suppression lookup in Resend webhook path
- [x] Keep suppression semantics intact

## Tests

- [x] Add targeted tests
- [x] Run targeted Vitest
- [x] Run lint on touched files

## Rollout

- [ ] Deploy the fix
- [ ] Retry/drain failed jobs
- [ ] Send validation email to `amanshresthaaaaa@gmail.com`

## Notes

- Assumptions:
  - Resend DNS and verified sender configuration are already correct.
- Deviations:
  - Direct local smoke-send via `tsx -e` was not used for final validation because the repo's `server-only` import does not resolve cleanly in that standalone runtime. Production validation will use the deployed app/runtime instead.
