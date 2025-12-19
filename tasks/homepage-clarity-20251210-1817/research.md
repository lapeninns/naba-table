---
task: homepage-clarity
timestamp_utc: 2025-12-10T18:17:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Homepage clarity

## Requirements

- Functional:
  - Simplify homepage content to reduce perceived clutter while retaining all existing sections (hero, metrics, trusted venues, journey, receipts, CTA).
  - Keep core CTAs obvious: Find a table, View my bookings, Sign in.
  - Introduce an inline SVG illustration that matches the design system (no new colors/fonts) to add visual interest without extra copy.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain keyboard accessibility for hero search/CTAs and list items.
  - Avoid new blocking assets; inline SVG should be lightweight and theme-friendly.
  - Keep copy concise for readability; support mobile-first spacing.

## Existing Patterns & Reuse

- Homepage composed in `src/app/(public)/page.tsx` using `Home*Section` components from `src/components/landing/HomeSections.tsx`.
- Design system tokens/utilities already applied (badge, button, card, typography, custom classes `border-sem`, `bg-elevated`, `heading-*`).
- Existing hero contains search form with `Input`, `Button`; metrics, trust, journey, receipts sections reuse cards/badges—will be retained but trimmed.

## External Resources

- None yet (design driven from in-repo system). No external assets required for the SVG.

## Constraints & Risks

- Must adhere to design system; no new color tokens or fonts.
- UI change requires Chrome DevTools MCP verification per policy.
- Over-trimming copy could remove critical reassurance; need to keep key trust signals.

## Open Questions (owner, due)

- None (user confirmed keeping all sections and adding SVG).

## Recommended Direction (with rationale)

- Reduce copy length to 1–2 lines per block and prune pill chips/lists to the essentials.
- Merge redundant trust messaging by limiting venue list items and tightening metrics descriptions.
- Add a lightweight inline SVG illustration in the hero right column to replace some text density while keeping CTA prominence.
