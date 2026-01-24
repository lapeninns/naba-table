---
task: fix-sunday-operating-hours
timestamp_utc: 2026-01-24T15:32:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm current day-of-week mapping in DB function and server code

## Core

- [x] Update RPC to use 0–6 day-of-week mapping
- [x] Add/adjust tests for Sunday booking

## Tests

- [ ] Unit/integration test for Sunday hours validation

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should we add server-side guard to detect mismatch?
