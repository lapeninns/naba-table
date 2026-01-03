---
task: b2b-micro-animations
timestamp_utc: 2026-01-03T01:28:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review relevant AGENTS policies
- [x] Confirm locations in `FactoryHomeClient.tsx`

## Core

- [x] Add GlobalStyles keyframes/utilities (float, shimmer, draw-check, text-shimmer, animate-float-slow, animate-count-up)
- [x] Implement `useCountUp` hook with IntersectionObserver

## UI/UX

- [x] Hero shimmer, float blobs, CTA hover/active
- [x] Problem/Benefits card hover and icon bloom
- [x] Metrics count-up and styles
- [x] Testimonials staggered reveal delays
- [x] Nav logo hover and footer underline hover

## Tests

- [x] Lint (warnings only)
- [x] Typecheck
- [ ] Unit tests (vitest failures; see verification.md)

## Notes

- Assumptions:
- Deviations: Chrome DevTools MCP QA pending.
