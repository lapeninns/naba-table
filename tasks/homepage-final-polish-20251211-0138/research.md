---
task: homepage-final-polish
timestamp_utc: 2025-12-11T01:38:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Homepage final polish

## Requirements

- Apply final UX polish to the guest homepage hero/benefits/testimonial/CTA using the existing design system (frontend-design skill).
- Keep layout responsive, emphasize CTA, and maintain accessibility.

## Existing Patterns & Reuse

- Homepage surface in `src/components/landing/FactoryHomeClient.tsx` already uses Factory theme tokens and utility classes.

## Constraints & Risks

- No new visual primitives; stay within defined tokens/styles.
- Keep copy intact from prior refresh.

## Recommended Direction

- Tighten hero spacing and button prominence.
- Group benefits/testimonial for better scan on mobile.
- Strengthen final CTA band contrast and hierarchy.
