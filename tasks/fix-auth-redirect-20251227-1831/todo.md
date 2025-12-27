---
task: fix-auth-redirect
timestamp_utc: 2025-12-27T18:32:23Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify current redirect fallback logic and tests

## Core

- [x] Update host-based fallback redirect to avoid guest fallback on app subdomain
- [x] Add/adjust tests for redirect helper

## UI/UX

- [ ] N/A

## Tests

- [ ] Unit
- [ ] Integration (manual)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Should fallback redirect be absolute for app subdomain in non-local env?
