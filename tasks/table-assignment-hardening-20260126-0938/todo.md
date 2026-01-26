---
task: table-assignment-hardening
timestamp_utc: 2026-01-26T09:38:31Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Remove adjacency mode flag surface and hardcode connected enforcement
- [x] Update docs/.env example

## Core

- [x] Enforce zone-lock in quote flow
- [x] Remove capacity overflow fallback in quote
- [x] Fail fast on hold conflicts in quote
- [x] Add early-exit/timeout diagnostics in selector
- [x] Remove/gate requireAdjacency overrides across API and assignment flows
- [x] Add adjacency-failure telemetry with table set in quote flow

## Tests

- [x] Unit tests for fixed adjacency rules
- [x] Unit tests for quote strictness
- [x] Run relevant test suite
- [x] Add capacity load-test script
- [x] Add adjacency edge-case unit tests
- [x] Document adjacencyFailure dashboards/alerts

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
