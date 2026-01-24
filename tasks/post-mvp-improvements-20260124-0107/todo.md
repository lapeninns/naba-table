---
task: post-mvp-improvements
timestamp_utc: 2026-01-24T01:07:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm routing/CTA fixes from `docs/BROKEN-LINKS-AND-ISSUES.md`.
- [ ] Identify all test endpoints and guard patterns.

## Core

- [ ] Fix invalid CTAs and redirects.
- [ ] Add redirect allow-list validation.
- [ ] Guard test endpoints with environment gate.
- [ ] Replace `window.location.reload()` UX with router refresh.
- [ ] Add `/api/health` endpoint.
- [ ] Add structured logging baseline.

## UI/UX

- [ ] Validate error/404 pages still provide correct CTAs.

## Tests

- [ ] Update/extend tests for redirect validation.
- [ ] Run relevant test suites.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- Monitoring provider choice and credentials.
