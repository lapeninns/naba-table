---
task: fix-ops-telemetry
timestamp_utc: 2026-02-04T20:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder and SDLC stubs

## Core

- [x] Ensure Replay integration is always registered and route-gated
- [x] Add PostHog pageview queue + flush after init

## Tests

- [ ] Manual sanity checks (not run)

## Notes

- Assumptions:
- Ops routes should not capture analytics.
- Deviations:

## Batched Questions

- None.
