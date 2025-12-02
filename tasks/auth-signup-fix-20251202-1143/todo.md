---
task: auth-signup-fix
timestamp_utc: 2025-12-02T11:43:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review signup routes/components/hooks/services.
- [x] Confirm env/config for auth tests (CSRF cookie via page; no extra env needed for unit tests).

## Core

- [x] Reproduce failing signup tests/issues (auth callback vitest failures).
- [x] Implement targeted fixes for signup flow.
- [ ] Ensure validation and error handling align with patterns.

## UI/UX

- [ ] Verify responsive layout & states (loading/error/success).
- [ ] Confirm accessibility (labels, focus, keyboard).

## Tests

- [x] Unit/Integration for signup path (vitest callback route).
- [ ] E2E/manual signup flow.
- [ ] Axe/Accessibility checks (DevTools MCP).

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
