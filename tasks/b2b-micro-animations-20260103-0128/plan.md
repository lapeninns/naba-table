---
task: b2b-micro-animations
timestamp_utc: 2026-01-03T01:28:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: B2B Micro-Animations

## Objective

Enhance the landing page with subtle, engineered micro-animations to improve engagement and perceived value.

## Success Criteria

- [ ] GlobalStyles includes float, shimmer, draw-check keyframes and required utility classes.
- [ ] Hero, cards, metrics, testimonials, nav/footer updated per animation spec.
- [ ] Metrics count-up triggers on in-view only.

## Architecture & Components

- `FactoryHomeClient.tsx`: update GlobalStyles, add `useCountUp` hook, adjust section classes.
- Existing `AnimationObserver` for reveal-up remains.

## Data Flow & API Contracts

- No API changes.

## UI/UX States

- In-view transitions for reveal-up and count-up; hover interactions for cards and links.

## Edge Cases

- Reduced-motion users should not see scroll-trigger animations.
- Count-up should avoid running when element not in view.

## Testing Strategy

- Run lint, typecheck, unit tests.
- Manual UI QA via Chrome DevTools MCP (required for UI changes).

## Rollout

- No flag; direct update.
