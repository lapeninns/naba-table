---
task: guest-full-coverage
timestamp_utc: 2026-02-02T19:40:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm guest-facing routes to cover and map to tests

## E2E Coverage

- [x] Add public marketing/auth E2E specs
- [x] Add guest portal redirect E2E specs
- [x] Extend booking/thank-you redirect E2E coverage

## Unit/Integration Coverage

- [x] Add tests for public restaurant list/detail/book pages (mocked data)
- [x] Add tests for guest view models

## Verification

- [x] Run: `pnpm exec playwright test --workers=2`
- [x] Run: `pnpm lint`
- [x] Run: `pnpm typecheck`
- [x] Run: `pnpm exec vitest run`

## Notes

- Assumptions:
- Deviations:
