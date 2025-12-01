---
task: walk-in-perf
timestamp_utc: 2025-11-30T22:36:13Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current `/walk-in` routing and auth page structure.
- [x] Identify where Plausible/NProgress is injected.

## Core

- [x] Remove extra redirect hop for `/walk-in` (direct route or rewrite).
- [ ] Make auth signin route static/ISR with cache headers.
- [x] Reduce client JS: move non-essential scripts to lazy load; ensure form mostly server-rendered.

## UI/UX

- [ ] Verify labels, focus, keyboard nav intact.
- [ ] Ensure loading/error states unchanged.

## Tests

- [ ] Manual Lighthouse/DevTools (mobile) before/after; save HAR + report.
- [ ] Axe/a11y quick check.

## Notes

- Assumptions: Auth page is public and safe to cache; authenticated redirect handled elsewhere.
- Deviations: None yet.

## Batched Questions

- None currently.
