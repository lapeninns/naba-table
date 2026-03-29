---
task: ops-bookings-performance-pass
timestamp_utc: 2026-03-29T16:28:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Audit prioritized pages against the dashboard reference pattern
- [x] Confirm the highest-value first implementation target

## Core

- [x] Narrow the chosen page's query/data/dialog/action boundaries
- [x] Move repeated derived view state out of render-time where possible
- [x] Tighten cache/update behavior if current mutations are overly broad

## UI/UX

- [x] Preserve current user-visible behavior and accessibility
- [x] Keep inactive/heavy regions as cold as possible

## Tests

- [x] Add or update targeted automated coverage for new helpers/selectors/hooks
- [x] Run targeted typecheck/lint/tests
- [x] Run manual Chrome DevTools verification

## Notes

- Assumptions:
- The dashboard refactor remains the canonical reference for this pass.
- Deviations:
- Manual browser verification used the public dev harness route (`/dev/ops-bookings-list`) instead of the auth-gated ops page so Chrome DevTools MCP could validate the changed list surface safely.

## Batched Questions

- None yet.
