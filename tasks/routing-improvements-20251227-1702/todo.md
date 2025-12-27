---
task: routing-improvements
timestamp_utc: 2025-12-27T17:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm routing improvement scope with maintainer

## Core

- [x] Make cross-host redirects absolute in `src/proxy.ts`
- [x] Guard www redirect in dev in `next.config.js`
- [x] Ensure proxy tests run (move file or update Vitest include)
- [x] Add routing smoke script

## Tests

- [x] Run proxy tests
- [x] Run routing smoke script

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
