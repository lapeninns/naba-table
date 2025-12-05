---
task: auth-resend-magic-link-fallback
timestamp_utc: 2025-12-04T10:45:22Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review current redirect builders and ImplicitAuthHandler usage.

## Core

- [x] Add implicit-flow redirect builder targeting `/auth/signin` with preserved params.
- [x] Use fallback redirect only for Resend/admin.generateLink path.
- [x] Keep primary `signInWithOtp` redirect unchanged.

## Tests

- [x] Update `src/app/api/auth/signin/route.test.ts` expectations.
- [x] Run `pnpm run test -- src/app/api/auth/signin/route.test.ts` (fails early: missing dev dependency `whatwg-fetch` in shared vitest setup).

## Notes

- Assumptions: ImplicitAuthHandler is mounted on `/auth/signin` layout and reads `redirectedFrom` from search params.
- Deviations: None.
