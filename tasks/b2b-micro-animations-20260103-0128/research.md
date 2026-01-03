---
task: b2b-micro-animations
timestamp_utc: 2026-01-03T01:28:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: B2B Micro-Animations

## Requirements

- Functional: add micro-animations to hero, cards, metrics, testimonials, nav/footer per prompt; implement count-up hook with IntersectionObserver.
- Non-functional: CSS/Tailwind + React hooks only; a11y-safe; no heavy animation libs.

## Existing Patterns & Reuse

- GlobalStyles style block in `FactoryHomeClient.tsx` already hosts reveal-up animation and tokens.
- `AnimationObserver` uses IntersectionObserver for reveal-up class.

## External Resources

- None.

## Constraints & Risks

- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Avoid new primitives; use existing styles and Tailwind utilities.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Extend GlobalStyles with keyframes/utilities and update `FactoryHomeClient.tsx` to add micro-interactions and count-up hook for metrics.
