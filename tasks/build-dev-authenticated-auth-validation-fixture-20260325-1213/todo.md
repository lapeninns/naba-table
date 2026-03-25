---
task: build-dev-authenticated-auth-validation-fixture
timestamp_utc: 2026-03-25T12:13:04Z
owner: github:@factory-droid
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing guest auth redirect logic and validation gaps
- [ ] Identify shared helper(s) for redirect sanitization and host-aware defaults

## Core

- [ ] Add dev-only auth validation harness route
- [ ] Reuse canonical redirect logic for guest and owner/admin scenarios
- [ ] Keep fixture isolated from shared local auth state

## UI/UX

- [ ] Render deterministic fixture summary / destination state
- [ ] Preserve safe guest/app intent messaging in the harness

## Tests

- [ ] Update Playwright auth coverage for harness flows (RED then GREEN)
- [ ] Run feature Playwright validator
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`
- [ ] Manual browser verification via dev harness

## Notes

- Assumptions: query-driven fixture state is acceptable because the feature specifically requires isolated validation, not real session persistence.
- Deviations:

## Batched Questions

- None in Exec mode.
