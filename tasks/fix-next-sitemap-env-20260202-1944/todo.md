---
task: fix-next-sitemap-env
timestamp_utc: 2026-02-02T19:45:03Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate malformed `.env.local` entry used by `@next/env`.

## Core

- [x] Fix invalid env interpolation causing `next-sitemap` parse error.
- [ ] If needed, harden `next-sitemap` config to avoid crashing on missing env.

## Tests

- [ ] `pnpm run build`

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
