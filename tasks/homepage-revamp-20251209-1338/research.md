---
task: homepage-revamp
timestamp_utc: 2025-12-09T13:38:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Research: Homepage Revamp

## Requirements

- **Functional**
  - Replace the existing marketing landing page (`src/app/(public)/page.tsx`) with a layout fully aligned to `DesignSystem.md` (tokens, atoms → templates).
  - Keep entry points to `/restaurants`, `/auth/signin`, and `/guest/bookings` with updated CTAs matching the new structure.
  - Surface design-system “DashboardTemplate” inspiration but adapted for a marketing landing context (hero + benefits + proof + CTA) using design atoms (NavBar, MetricTile, ProfileCard, etc.).
- **Non-functional**
  - Maintain accessibility (semantic headings, focus states, keyboard support) and responsiveness from mobile through desktop.
  - Preserve current SEO metadata exports from the page module.
  - Ensure new UI respects `MarketingLayout` theme and avoids inline colors outside token set defined in `DesignSystem.md`.

## Existing Patterns & Reuse

- Current homepage already composes `MarketingLayout`, `Badge`, `Button`, `Card`, etc., so we can keep high-level structure but swap inner content for the design system components.
- `DesignSystem.md` exposes ready-to-use JSX patterns (GlobalStyles, NavBar, DashboardTemplate, MetricTile, ProfileCard, DataTable, etc.) that can be adapted into Next components or reimplemented with Tailwind tokens referencing the same tokens.
- `components/layouts/MarketingLayout` already applies `.guest-theme` background; we just need to ensure new sections slot into the same container.
- We can reuse `components/shared` primitives (if needed) but goal is to reference design system tokens; we may implement new `landing` components under `components/landing` if necessary.

## External Resources

- [`DesignSystem.md`](DesignSystem.md) — authoritative reference for tokens, density, typography, components (atoms → templates) to mirror on homepage.

## Constraints & Risks

- **Scope**: Page must be “solely based on the design system,” meaning ad hoc gradients/imagery should be minimized; we should map hero/sections to provided components.
- **Perf**: Introducing heavy imagery or complex components can affect FCP; we should stick to lightweight, mostly vector/gradient visuals defined by tokens.
- **A11y**: The design system enforces focus rings/aria attributes; ensure CTA buttons and nav adopt those patterns to avoid regressions.
- **Timeline**: Need research + plan before coding per SDLC policy; ensure artifacts recorded in task directory.

## Open Questions (owner, due)

- None identified; requirements are explicit from user request + design system reference. (owner: github:@factory-droid, due: 2025-12-09)

## Recommended Direction (with rationale)

- Structure homepage into four template-driven bands inspired by `DashboardTemplate` but marketing-optimized: hero (NavBar-style top + hero CTA), credibility metrics (MetricTile grid), experience walkthrough (DataTable/ProfileCard mash-up), and closing CTA referencing design tokens.
- Build composable section components inside `src/components/landing/` that directly mirror design system molecules (e.g., `HeroSection`, `MetricsGrid`, `ExperienceShowcase`, `FinalCTA`). This keeps `page.tsx` minimal and makes future reuse easier.
- Import existing Shadcn primitives for consistent behavior; align typography/spacing to tokens described in `DesignSystem.md` (Spacing 2–10, radii md–xl, etc.).
