---
task: homepage-revamp
timestamp_utc: 2025-12-10T21:30:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Homepage Layout Revamp

## Requirements

- Functional: Refresh the marketing homepage to feel more visual and experiential while keeping core booking CTAs prominent and accessible.
- Non-functional (a11y, perf, security, privacy, i18n): Maintain WCAG keyboard/focus patterns, preserve fast load (avoid heavy assets), reuse design-system tokens, ensure content remains legible across breakpoints.

## Existing Patterns & Reuse

- Current homepage uses `MarketingLayout` with sections in `src/components/landing/HomeSections.tsx` (hero, metrics, trusted, journey, receipts, CTA) and design tokens from `globals.css`/`DesignSystem.md`.
- UI primitives: `Button`, `Badge`, `Card`, and typography utilities already available; should compose rather than invent.
- Background + nav/footer via `GuestBackground`, `GuestNavbar`, `Footer`.

## External Resources

- Design system tokens documented in `DesignSystem.md` (colors, radii, shadows, typography, motion). Required for consistency.

## Constraints & Risks

- Must follow root + `src/app` AGENTS: Shadcn-first, a11y required, manual DevTools MCP for UI changes, no new visual primitives outside design system.
- Supabase is remote-only (not impacted by UI-only change but keep in mind for auth guard).
- Avoid regressions to routing/links (`/restaurants`, `/guest/bookings`, `/auth/signin`).

## Open Questions (owner, due)

- Desired tone: more premium vs playful? (owner: design, due: before implementation)
- Any hero photography/illustration assets to include, or stick to abstract system shapes? (owner: design/content)
- Keep all existing sections or consolidate (e.g., metrics + trust)? (owner: product)

## Recommended Direction (with rationale)

- Reframe page into a **three-band narrative**: Hero with split visual rail + action panel; Proof band combining metrics/live feed; Journey + reassurance grid; Receipt preview + CTA.
- Use **grid-based, asymmetric layout** leveraging existing cards, gradients, and shadow tokens to add depth without new colors.
- Introduce **interactive highlight rail** using existing badges/icons to break up text density while staying within design tokens.
- Preserve current CTAs but emphasize primary booking CTA in hero and a secondary sticky/inline CTA for scanning.
