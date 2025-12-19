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

# Research: Guest Footer Refresh

## Requirements

- **Functional**
  - Provide a unified footer for all guest-facing public routes (`src/app/(public)/**`, `/guest/**` shells) leveraging the tokens and component language defined in `DesignSystem.md`.
  - Surface primary CTAs (download app / discover restaurants / contact support), quick navigation, and business metadata (copyright, social links, legal).
  - Ensure responsive layout from 320px through desktop, with semantic structure and accessible focus order.
- **Non-functional**
  - Adhere strictly to tiered tokens (colors, spacing, typography) instead of ad hoc values.
  - Maintain WCAG AA color contrast and keyboard operability for all interactive items.
  - Minimize bundle impact by reusing shared primitives (buttons, icon components) instead of ad hoc SVG imports per page.

## Existing Patterns & Reuse

- `components/layout/Footer.tsx` already exports a marketing footer but is out of sync with the new design system—refreshing this shared component keeps entry points centralized for marketing and guest shells.
- `DesignSystem.md` demonstrates layout primitives (grid spacing, text stacks, CTA rows) we can mirror via Tailwind utilities referencing the same tokens.
- Iconography can reuse `@radix-ui/react-icons` already shipped in the repo as seen in other layout components; focus rings + typography come from the global CSS tokens.
- `components/layouts/MarketingLayout` composes `Footer` today for marketing pages, so updating `Footer` automatically benefits `(public)` without extra wiring.

## External Resources

- [`DesignSystem.md`](../../DesignSystem.md) — source of truth for tokens, component spacing, and behavior that the footer must reflect.
- Existing marketing QA artifacts (Lighthouse in `tasks/homepage-revamp-*`) demonstrate acceptable perf/a11y budgets relevant to this work.

## Constraints & Risks

- Updating `Footer.tsx` affects all consumers; must ensure props remain backward compatible (or adjust consumers together) to avoid layout regressions.
- Need to support dark backgrounds if any guest pages toggle dark mode (respect `[data-theme]` tokens rather than hard-coded light colors).
- Footer content must remain CMS-agnostic; avoid fetching remote data within the component per layering rules.
- Failing to run Chrome DevTools MCP for UI updates would violate policy; plan to capture artifacts post-implementation.

## Open Questions (owner, due)

- Do we need localized/legal links per region? → For now reuse existing static links; escalate later if localization requirements emerge. (owner: github:@factory-droid, due: 2025-12-11)

## Recommended Direction (with rationale)

- Redesign `components/layout/Footer.tsx` into a token-driven component structured as: brand/CTA column, navigation columns (Explore, Company, Support), newsletter/social row, and bottom legal strip referencing design-system spacing.
- Use CSS grid/flex combos inspired by `DesignSystem.md` (radius-md cards, var spacing), referencing classes like `max-w-[var(--layout-container-max)]` to keep alignment with other shells.
- Expose props for `hideCTA` or allow slotting optional children if future tasks need variations; for this task, keep API simple but ensure marketing + guest pages both benefit by reusing this single component.
