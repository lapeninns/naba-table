---
task: auth-redirect
timestamp_utc: 2025-12-11T07:52:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify existing redirect/auth routing logic
- [x] Confirm applicable AGENTS policies for touched paths

## Core

- [x] Update `src/app/(public)/page.tsx` to redirect authenticated users to `/guest/dashboard`
- [x] Preserve unauthenticated root behavior (marketing page renders)

## UI/UX

- [ ] Ensure a11y unaffected (if UI touched)

## Tests

- [x] Add/update tests covering redirect behavior (`pnpm vitest run tests/server/homepage-redirect.test.tsx`)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
