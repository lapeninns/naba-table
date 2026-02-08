---
task: fix-vercel-function-size
timestamp_utc: 2026-02-08T21:02:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update continuity ledger.

## Core

- [x] Add `outputFileTracingExcludes` to `next.config.js`.
- [x] Add `.vercelignore` for `tasks/**/artifacts/**`.

## Tests

- [ ] Confirm Vercel build passes (external).

## Notes

- Assumptions:
  - Vercel respects `.vercelignore` for build context.
- Deviations:
  - None.

## Batched Questions

- None.
