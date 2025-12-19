---
task: guest-ui-redesign
timestamp_utc: 2025-12-03T20:35:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm design tokens (colors, typography, spacing) and document in theme.
- [ ] Add feature flag `feat.guest.ui` (default off) around new shells/templates.
- [ ] Scaffold shared layout/components (marketing shell, guest shell, cards, CTA buttons, banners).

## Core

- [ ] Migrate marketing pages to new design system (home, restaurants list/detail, booking entry).
- [ ] Rebuild booking wizard UI with new templates; keep data hooks/services intact.
- [ ] Update booking manage/receipt/thank-you flows with consistent layouts and action rails.
- [ ] Redesign guest dashboard, bookings list/detail, profile with responsive grids and states.
- [ ] Ensure auth redirects and deep links remain functional.

## UI/UX

- [ ] Implement loading/empty/error/success states per template.
- [ ] Validate focus management, aria-live for async toasts/banners, pointer targets.
- [ ] Optimize images/aspect-ratio to avoid CLS; respect prefers-reduced-motion.

## Tests

- [ ] Unit tests for shared components (cards, wizard stepper, banners).
- [ ] Integration tests for booking wizard and manage flows.
- [ ] E2E/acceptance smoke for marketing → booking → receipt, and guest dashboard flows.
- [ ] Axe/Lighthouse accessibility/perf checks via Chrome DevTools MCP.

## Notes

- Assumptions:
  - No backend/schema changes required; existing APIs remain stable.
  - Brand approves updated palette/typography before build.
- Deviations:
  - TBD (log here during implementation).

## Batched Questions

- [ ] Pending answers from Open Questions in research.md (palette, motion, assets, copy, flag rollout).
