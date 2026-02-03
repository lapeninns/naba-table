---
task: guest-booking-tests
timestamp_utc: 2026-02-02T14:10:26Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add unit/integration test tooling and config
- [x] Add E2E + a11y test tooling and config
- [x] Extend Playwright config for reserve + Next dev servers

## Core

- [x] Unit tests for booking wizard steps + helpers
- [x] Integration tests for booking API handlers

## UI/UX

- [x] A11y checks for booking wizard steps

## Tests

- [x] E2E booking create flow
- [x] E2E booking detail/manage flow (read/update/cancel)
- [x] Run validators (lint/typecheck/tests)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
