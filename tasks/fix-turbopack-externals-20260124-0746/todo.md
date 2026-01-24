---
task: fix-turbopack-externals
timestamp_utc: 2026-01-24T07:46:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm missing externals and config touchpoints.

## Core

- [ ] Add dependencies for import-in-the-middle and require-in-the-middle.
- [ ] Configure Next.js to bundle ioredis (disable externalization).

## Tests

- [ ] Run `pnpm run build` and capture results.

## Notes

- Assumptions:
- Deviations:
