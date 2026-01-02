---
task: landing-page-replace
timestamp_utc: 2026-01-02T21:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Landing Page Replace

## Objective

We will replace the public landing page client component with the provided layout so marketing can ship the new positioning with the existing route.

## Success Criteria

- [ ] `src/components/landing/FactoryHomeClient.tsx` matches the provided layout and copy.
- [ ] Uses Shadcn UI primitives for buttons and badges.
- [ ] No new data dependencies or API calls.

## Architecture & Components

- `FactoryHomeClient`: root section layout, global styles, and sections.
- Sections: Hero, Metrics, Benefits, HowItWorks, Testimonials, FAQ, CTA, Footer.
- State: local for live feed rotation and reduced-motion preference.

## Data Flow & API Contracts

- None. Static content only.

## UI/UX States

- Reduced motion: disable reveal observer and live feed auto-rotation.
- Responsive layout from mobile to desktop.

## Edge Cases

- Prefers-reduced-motion enabled.
- Long copy wrapping on small screens.

## Testing Strategy

- Lint, typecheck, unit tests as configured.
- Manual UI QA via Chrome DevTools MCP (required).

## Rollout

- No feature flag required; replace existing landing page.

## Deviations

- Inline styles used for theme CSS variables and staggered animation delays (no existing utility alternative).
