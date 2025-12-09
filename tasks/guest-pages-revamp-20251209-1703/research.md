---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T17:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Guest Pages Revamp

## Requirements

- Functional:
  - Revamp **all guest-facing pages** (marketing landing, restaurant listing/detail, booking wizard/thank-you, guest dashboard/booking detail/profile, auth entry) to visually align with the patterns and tokens in `DesignSystem.md`.
  - Keep existing flows, routes, and content intact; changes are visual/theming only.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain WCAG compliance: focus visibility, keyboard navigation, semantic structure unchanged.
  - Perf budgets: mobile FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10, TBT ≤ 200ms.
  - Light mode only (per stakeholder); do not introduce dark mode toggles.
  - No new assets; reuse current imagery/icons.
  - Security/privacy unchanged; no new data flows.

## Existing Patterns & Reuse

- Layout shells: `GuestLayout`, `MarketingLayout`, `AuthLayout` share `GuestBackground`, `GuestNavbar`, `Footer`, and `ThemeProvider (guest)`.
- Marketing surfaces: `src/components/landing/HomeSections.tsx` drives `/` hero/metrics/journey/CTA.
- Restaurant surfaces: `src/components/restaurants/PublicSections.tsx` powers list, detail, booking shell, and thank-you.
- Booking/dash surfaces: `components/features/booking/*`, `components/features/guest/dashboard/*`, `ReceiptClient`, `BookingComponents` already use Shadcn primitives and guest tokens.
- Tokens/themes: `styles/themes/guest.css`, `src/app/globals.css` define CSS vars; design system spec in `DesignSystem.md` provides updated semantic tokens + utility classes (`heading-*`, `shadow-card`, `input-base`, etc.).

## External Resources

- [DesignSystem](../DesignSystem.md) — authoritative tokens, utility classes, and component patterns to mirror across guest pages.

## Constraints & Risks

- Scope is broad (all guest-facing pages) — risk of inconsistent application or visual regressions if not centralized.
- Must avoid changing behavior/logic; refactors limited to styling/structure.
- Need to keep light-mode only; dark-mode tokens in guest theme must not be activated accidentally.
- Performance regressions possible if new assets or heavy effects are added (avoid).
- A11y regressions if focus states/semantics are altered when re-styling.

## Open Questions (owner, due)

- (None; requirements confirmed with requester on 2025-12-09.)

## Recommended Direction (with rationale)

- Introduce a reusable **Design System styles injector** (from `DesignSystem.md`) applied in guest/marketing/auth layouts to ensure tokens/utilities are available without touching app area.
- Refresh shared shells (navbar/background/layout wrappers) to use the design system variables (colors, radii, shadows) and reduce ad-hoc gradients.
- Update high-traffic guest pages (`/`, `/restaurants`, `/restaurants/[slug]`, `/restaurants/[slug]/book`, `/guest/dashboard`, `/guest/bookings/*`, `/auth/signin`) to consume the design-system utility classes and semantic tokens (e.g., `.heading-xl`, `.shadow-card`, `.bg-elevated`, `.input-base`).
- Keep content/assets as-is; improve CTA hierarchy and spacing for conversion using existing buttons/links.
