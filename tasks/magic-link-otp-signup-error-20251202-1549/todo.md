---
task: magic-link-otp-signup-error
timestamp_utc: 2025-12-02T15:49:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review auth routes and existing tests
- [x] Confirm expected Supabase error signature for signup-disabled path

## Core

- [x] Adjust magic link sign-in behavior to avoid signup-disabled error (service-role fallback)
- [x] Ensure clear messaging for new users when signups are disabled
- [x] Add fallback using service-role client without creating users

## UI/UX

- [ ] Confirm no UI regressions; update copy if needed

## Tests

- [x] Update/add unit tests for magic link behavior (service fallback + missing user)
- [x] Run relevant test suite (vitest: src/app/api/auth/signin/route.test.ts)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
