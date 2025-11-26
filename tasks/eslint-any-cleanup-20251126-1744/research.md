---
task: eslint-any-cleanup
timestamp_utc: 2025-11-26T17:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: ESLint any cleanup in ops bookings cache test

## Requirements

- Functional: resolve @typescript-eslint/no-explicit-any warnings in tests/server/ops-bookings-cache.test.ts to allow pre-commit lint to pass.
- Non-functional (a11y, perf, security, privacy, i18n): none; test-only change.

## Existing Patterns & Reuse

- Tests typically type mocks using concrete interfaces or minimal typed shapes within file.
- eslint config enforces no-explicit-any; other tests likely use typed helpers.

## External Resources

- N/A (internal lint rule only).

## Constraints & Risks

- Avoid altering runtime logic; only typing changes.
- Ensure tests still compile and semantics unchanged.

## Open Questions (owner, due)

- None identified.

## Recommended Direction (with rationale)

- Replace `any` typed mocks with structured type definitions (interfaces or inline types) matching expected shape in the test helpers so lint passes without behavior change.
