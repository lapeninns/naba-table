---
task: instant-email-inline
timestamp_utc: 2025-12-27T07:41:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm instant vs scheduled email type list

## Core

- [x] Add instant-email allowlist and bypass queue in booking side-effects
- [x] Keep reminder/review scheduling queue behavior unchanged
- [x] Update documentation

## Tests

- [ ] Optional: exercise test endpoints for instant vs scheduled paths

## Notes

- Assumptions:
  - Instant types list confirmed by user
- Deviations:
  - Context7/DeepWiki not used; internal codebase inspection was sufficient

## Batched Questions

- None
