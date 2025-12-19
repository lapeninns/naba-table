---
task: homepage-final-polish
timestamp_utc: 2025-12-11T01:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Homepage final polish

## Objective

Refine homepage hero, benefits/testimonial, and final CTA using the existing design system for stronger hierarchy and mobile readability.

## Steps

- [ ] Adjust hero spacing/typography and CTA emphasis.
- [ ] Re-layout benefits + testimonial into a cohesive grid for mobile/desktop.
- [ ] Refresh final CTA band styling for contrast and clarity.

## Testing

- [ ] Quick visual check at mobile (375px) and desktop widths.
- [ ] `pnpm run lint --ext .ts,.tsx --max-warnings=0 src/components/landing/FactoryHomeClient.tsx` (acknowledge global warnings if present).
