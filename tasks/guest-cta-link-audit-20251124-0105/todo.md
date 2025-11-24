---
task: guest-cta-link-audit
timestamp_utc: 2025-11-24T01:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify base URL and sample slugs/ids for guest routes. (Using default venue slug `white-horse-pub-waterbeach`.)
- [ ] Start local app or use staging URL for crawling.

## Core

- [ ] Run automated crawl/link check across guest-facing routes.
- [x] Enumerate CTA elements (buttons/links) with labels and href targets; retargeted CTAs to working booking flow.

## UI/UX

- [ ] Manually verify CTA destinations on key pages.
- [ ] Capture any broken/misdirected links.

## Tests

- [ ] Record verification steps and results in `verification.md`.

## Notes

- Assumptions: dynamic routes will resolve using provided fixtures.
- Deviations:
  - Performed static code audit (no automated crawl yet). Findings captured in `artifacts/cta-and-broken-links.md`.

## Batched Questions

- What staging/local base should be authoritative for this audit?
