---
task: remove-static-marketing-pages
timestamp_utc: 2025-11-23T18:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify marketing routes and CTA usage.

## Core

- [x] Delete `/contact` page.
- [x] Delete `/product` page.
- [x] Delete `/privacy-policy` page.
- [x] Delete `/terms` page.
- [x] Remove navbar CTA and related links.
- [x] Remove footer links to deleted pages.
- [x] Sweep for remaining references to deleted routes or `/ops/login`.
- [x] Remove `/partners` route.
- [x] Remove marketing landing `/`.
- [x] Update guest-facing routes doc and clarify `/item/:slug`.
- [x] Remove `/restaurants` index route.

## Tests

- [ ] Lint/type check (note if skipped).

## Notes

- Assumptions: No other parts depend on these marketing pages.
- Deviations: Manual UI QA may be deferred if no render targets remain.
