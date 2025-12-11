---
task: factory-landing-showcase
timestamp_utc: 2025-12-10T22:06:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add design narrative doc with sections A/B/C.
- [x] Create `/dev/factory-landing` route scaffold (client entry).

## Core

- [x] Implement Factory theme tokens scoped to the page wrapper.
- [x] Build NavBar, Hero with floating SearchBar, Bento metrics grid, feature section, footer per provided layout.
- [x] Live feed carousel cycles every ~3s.

## UI/UX

- [x] Ensure responsive stacking (mobile → single column).
- [x] Keyboard focusable buttons/inputs; visible focus.
- [x] Respect `prefers-reduced-motion` for animations.

## Tests

- [x] Run `pnpm lint`.
- [x] Manual QA on `/dev/factory-landing` (desktop + mobile) with screenshot saved to artifacts.

## Notes

- Assumptions: Reference-only page; no production route changes.
- Deviations:

## Batched Questions

- None at this time.
