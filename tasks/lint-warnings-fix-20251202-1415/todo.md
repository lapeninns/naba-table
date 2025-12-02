---
task: lint-warnings-fix
timestamp_utc: 2025-12-02T14:15:09Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm relevant AGENTS policies (root + src/app).

## Core

- [x] Remove unused import in `src/app/api/auth/signup/route.ts`.
- [x] Remove unused variable/comment alignment in `src/app/api/onboarding/restaurant/[id]/zones/route.ts`.
- [x] Remove unused import in `src/app/api/onboarding/restaurant/route.ts`.

## Tests

- [x] Run eslint (`pnpm lint` or equivalent) ensuring zero warnings.

## Notes

- Assumptions: Lint cleanup should not alter runtime behavior.
- Deviations: None yet.
