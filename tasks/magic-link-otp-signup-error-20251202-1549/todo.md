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

- [ ] Adjust magic link sign-in behavior to avoid signup-disabled error (reverted to previous working behavior)
- [ ] Ensure clear messaging for new users when signups are disabled
- [ ] Add fallback using service-role client without creating users

## UI/UX

- [ ] Confirm no UI regressions; update copy if needed

## Tests

- [ ] Update/add unit tests for magic link behavior (reverted)
- [x] Run relevant test suite (vitest: src/app/api/auth/signin/route.test.ts)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
