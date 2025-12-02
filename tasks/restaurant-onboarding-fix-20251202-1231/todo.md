---
task: restaurant-onboarding-fix
timestamp_utc: 2025-12-02T12:31:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify onboarding routes/components and services involved.
- [x] Confirm which ops hooks/services still call `/api/restaurants`.

## Core

- [x] Reproduce onboarding flow and capture failing step (DevTools).
- [x] Point ops restaurant service + related hooks to `/api/ops/restaurants` endpoints (hours, profile, service periods, logo upload).
- [x] Verify no regressions in other ops calls.

## UI/UX

- [x] Ensure loading/error states remain accessible and clear.

## Tests

- [x] Manual E2E via Chrome DevTools MCP.
- [ ] Add/update automated test if needed.

## Notes

- Assumptions: None yet.
- Deviations: None.
