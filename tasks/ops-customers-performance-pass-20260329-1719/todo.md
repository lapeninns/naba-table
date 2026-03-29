---
task: ops-customers-performance-pass
timestamp_utc: 2026-03-29T17:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add customers query-state hook
- [x] Add customers data-state hook
- [x] Add guest-row selectors/view models

## Core

- [x] Thin `OpsCustomersClient` down to composition and page-level guards
- [x] Pass precomputed guest rows into `CustomersTable`
- [x] Update `OpsGuestCard` to consume the new row model

## UI / UX

- [x] Preserve filter controls, badges, and refresh/export behavior
- [x] Preserve infinite loading and focus-on-customer behavior
- [x] Preserve loading/empty/error states

## Tests

- [x] Add selector/view-model tests
- [x] Add/adjust component tests for changed props/behavior
- [x] Run targeted lint/typecheck/tests
- [x] Run Chrome DevTools MCP verification on the dev harness

## Notes

- Assumptions:
  - Existing `hooks/useOpsCustomers.ts` stays canonical for data fetching.
  - The biggest gain is reducing render-time guest-card derivation rather than replacing the data hook.
- Deviations:
  - `tests/setup.ts` now stubs `window.scrollTo` unconditionally to keep jsdom-based list tests quiet.

## Batched Questions

- None at the moment.
