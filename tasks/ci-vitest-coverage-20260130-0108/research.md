---
task: ci-vitest-coverage
timestamp_utc: 2026-01-30T01:08:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Align Vitest Coverage with CI

## Requirements

- Ensure `pnpm test:ci` passes with current coverage scope.
- Keep coverage collection available for CI without failing due to current baseline.

## Existing Patterns & Reuse

- `vitest.config.ts` already defines coverage include/exclude and thresholds.
- CI runs unit tests via `pnpm test:ci` in `.github/workflows/ci.yml`.

## Constraints & Risks

- Coverage thresholds are currently higher than existing coverage, causing CI failures.
- Avoid changing test scope beyond configuration.

## Recommended Direction

- Make coverage thresholds permissive for now to allow CI to pass while coverage grows.
