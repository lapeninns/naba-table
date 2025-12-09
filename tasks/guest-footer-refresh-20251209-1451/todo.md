---
task: guest-footer-refresh
timestamp_utc: 2025-12-09T14:51:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Inventory current `components/layout/Footer.tsx` usage to understand API/props.
- [ ] Align palette/spacing choices with `DesignSystem.md` tokens (document any deviations).

## Core

- [ ] Redesign `Footer.tsx` with CTA band, navigation columns, newsletter/contact, and social/legal strip using semantic HTML.
- [ ] Create helper data structures for navigation groups + social links to keep JSX lean.
- [ ] Ensure responsive behavior (stacked on mobile, grid on desktop) using Tailwind + CSS token vars.

## UI/UX

- [ ] Confirm focus-visible states and aria labels for nav sections + social/icon buttons.
- [ ] Smoke test guest marketing pages to verify layout and theming (light/dark) behave as expected.

## Tests

- [ ] Run `pnpm run lint`.
- [ ] Run `pnpm run test` (or targeted relevant suite if full run is excessive).
- [ ] Execute Chrome DevTools MCP manual audit on a representative guest route and capture artifacts for `verification.md`.

## Notes

- Assumptions: Footer remains static content without localization switch for now.
- Deviations: none yet.
