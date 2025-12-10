---
task: guest-homepage-revamp
timestamp_utc: 2025-12-10T16:44:00Z
owner: github:@assistant
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder with research/plan stubs
- [ ] Confirm design direction/assumptions with stakeholder (if available)

## Core

- [x] Redesign hero section in `src/components/landing/HomeSections.tsx` with updated layout/CTAs
- [x] Refresh proof/metrics band using design-system tokens
- [x] Update journey/benefits grid for clarity and accessibility
- [x] Rework CTA strip to align with new narrative
- [x] Keep `src/app/(public)/page.tsx` composition unchanged aside from section imports (if needed)

## UI/UX

- [ ] Verify responsive behavior (mobile/tablet/desktop)
- [ ] Ensure headings hierarchy, labels, and focus-visible states
- [ ] Confirm link targets (`/restaurants`, `/auth/signin`, `/guest/bookings`) remain correct

## Tests

- [ ] pnpm lint
- [ ] pnpm test (or targeted) if impacted
- [ ] Manual QA via Chrome DevTools MCP (Lighthouse, HAR, a11y) on `/`

## Notes

- Assumptions: Copy can be adjusted; no new assets required.
- Deviations: TBD

## Batched Questions

- Should hero copy emphasize last-minute openings vs premium picks?
- Do we need logo bar/testimonials alongside metrics?
