---
task: homepage-guest-copy-refresh
timestamp_utc: 2025-12-11T00:54:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review current homepage layout in `src/app/(public)/page.tsx`.

## Core

- [x] Update hero headline, subheader, CTA text.
- [x] Add social proof line under CTA.
- [x] Insert testimonial, objection busters, and benefit blurbs.
- [x] Add pre-final stat and final CTA text.

## UI/UX

- [ ] Verify copy fits on mobile widths without wrapping issues.
- [ ] Confirm CTA remains primary and accessible.

## Tests

- [ ] Manual smoke test on desktop and mobile sizes.
- [ ] Quick a11y check (keyboard focus, landmarks).

## Notes

- Assumptions: Copy uses provided default numbers; no design-system changes needed.
- Deviations: Augment MCP unavailable; used file inspection via `rg`/code read.

## Batched Questions

- None currently.
