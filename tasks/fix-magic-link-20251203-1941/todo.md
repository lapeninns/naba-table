---
task: fix-magic-link
timestamp_utc: 2025-12-03T19:41:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify relevant auth/magic link modules and env requirements.
- [x] Confirm email provider credentials present for staging.

## Core

- [x] Reproduce 500 error and capture stack trace.
- [x] Fix root cause (config/hostname/provider call) and ensure graceful error handling.

## UI/UX

- [ ] Ensure sign-in page shows success state on send.
- [ ] Keep a11y intact (focus, semantics).

## Tests

- [ ] Add/update tests if applicable; otherwise document manual verification. (Added fallback test; run blocked by missing vitest setup file)

## Notes

- Assumptions: using existing provider; no new feature flag.
- Deviations: none yet.

## Batched Questions

- Pending answers on provider configuration.
