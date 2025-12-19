---
task: guest-homepage-revamp
timestamp_utc: 2025-12-10T16:44:00Z
owner: github:@assistant
reviewers:
  - github:@maintainers
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Homepage Revamp

## Requirements

- Functional:
  - Refresh the guest-facing landing page at `src/app/(public)/page.tsx` using the existing design system tokens/components (per `DesignSystem.md` and guest theme utilities).
  - Preserve key CTAs to `/restaurants`, `/auth/signin`, and `/guest/bookings` with accessible buttons/links.
  - Maintain current SEO metadata exports and MarketingLayout usage.
- Non-functional:
  - Mobile-first, WCAG-compliant (semantic headings, labeled form fields, focus-visible, keyboard operable).
  - Keep perf within existing budgets (lightweight assets, reuse components, avoid new heavy media).
  - Align visuals strictly to design tokens; no new colors/radii/shadows.

## Existing Patterns & Reuse

- `MarketingLayout` already wraps the homepage with `.guest-theme`, `GuestNavbar`, `Footer`, and background (`GuestBackground`).
- Sections live in `src/components/landing/HomeSections.tsx` and use bridge utilities (`border-sem`, `bg-elevated`, guest radii) from `styles/guest-design-system.css` / `globals.css`.
- Design tokens and atoms documented in `DesignSystem.md` (GlobalStyles, Button, Badge, Input, MetricTile, etc.).
- Route audit (`guest-facing-routes.md`) confirms `/` is marketing/guest-themed and must remain stable.

## External Resources

- `DesignSystem.md` — canonical tokens, typography utilities, component patterns.
- `styles/guest-design-system.css` — guest-scoped utility bridge (`heading-*`, `border-sem`, `bg-elevated`, `input-base`).
- `guest-facing-routes.md` — recent audit of guest routes and theme hierarchy.

## Constraints & Risks

- Large layout changes could impact FCP/CLS if we introduce heavy imagery or unset sizes; must reserve space and keep assets lightweight.
- CTA/link changes risk breaking primary flows; ensure URLs remain unchanged and navigation semantics stay intact.
- A11y regression risk if headings hierarchy or form labels are altered; must double-check keyboard flows.
- Must comply with SDLC: task artifacts, plan, and manual DevTools MCP QA for UI changes.

## Open Questions (owner, due)

- Tone emphasis: should hero copy lean toward last-minute availability or premium curation? (owner: github:@assistant, due: 2025-12-11)
- Do we need social proof logos or testimonials beyond metrics? (owner: github:@assistant, due: 2025-12-11)

## Recommended Direction (with rationale)

- Keep `page.tsx` as a thin composer but redesign `HomeSections` to a clearer narrative: hero with search/CTA + live status card, credibility band (metrics/logos), experience walkthrough (steps + benefit grid), and a bold CTA strip.
- Reuse design-system atoms (Button, Badge, Card, Input) with guest bridge classes for consistent spacing/radii; avoid new visual primitives.
- Maintain static data arrays for metrics/steps to keep page static; focus on layout/typography rather than new data fetching.
