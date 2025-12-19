---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T17:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Pages Revamp

## Objective

We will enable guests to experience a refreshed, consistent UI aligned with the design system across public and guest-facing pages.

## Success Criteria

- [ ] Guest-facing pages use `DesignSystem.md` tokens/utilities (headings, shadows, inputs, badges) with light mode only.
- [ ] Flows untouched functionally; a11y remains (focus, semantics, keyboard) and perf budgets met (FCP ≤ 2.0s, LCP ≤ 2.5s, CLS ≤ 0.10, TBT ≤ 200ms).
- [ ] Visual consistency across landing, restaurant discovery/detail/booking, auth, and guest dashboard/booking detail/receipt.
- [ ] Conversion-oriented CTAs remain primary/secondary with clear hierarchy.

## Architecture & Components

- **Design System CSS bridge**: add guest-scoped utility layer (`heading-*`, `shadow-card`, `bg-elevated`, `border-sem`, `input-base`, etc.) sourced from `DesignSystem.md`, imported via `globals.css`.
- **Layouts**: refresh `MarketingLayout`, `GuestLayout`, `AuthLayout` to use design-system surfaces/backgrounds and consistent padding containers.
- **Shared nav/surface**: adjust `GuestNavbar`/`GuestBackground` styling to match tokens without altering logic.
- **Pages/components**:
  - Landing sections (`HomeSections`) — apply heading/text utilities, card shadows, semantic colors.
  - Restaurant public sections (`PublicSections`) — cards/hero/shells updated to semantic utilities and spacing.
  - Restaurant booking shell (`RestaurantBookingShell`) and thank-you card — align with design tokens.
  - Booking receipt/client (minor surface tweaks if needed) while preserving actions.

## Data Flow & API Contracts

No API/contract changes; purely presentational. Ensure data-loading paths untouched.

## UI/UX States

- Loading/empty/error states preserved; only visual tokens updated.

## Edge Cases

- Keep `.guest-theme` light-only; ensure no dark-mode regressions.
- Maintain scroll/skip links and focus states when restyling buttons/inputs.
- Token utilities must not leak into app area — scope to guest/global layer carefully.

## Testing Strategy

- Visual smoke across key pages: `/`, `/restaurants`, `/restaurants/[slug]`, `/restaurants/[slug]/book`, `/guest/dashboard`, `/guest/bookings/[id]`, `/guest/bookings/[id]/receipt`, `/auth/signin`.
- Axe/keyboard sanity via Chrome DevTools MCP; Lighthouse sample on `/` and `/restaurants`.
- No new unit tests (styling-only) unless refactors touch interactive components.

## Rollout

- Feature flag: none (styling-only). If needed, wrap major surface changes behind `guest-design` CSS toggle env; default on.
- Exposure: direct rollout once validated; monitor conversion funnels (landing → restaurants → book).
- Monitoring: existing analytics (Plausible) + event emissions already in components.
- Kill-switch: revert CSS bridge import or layout surface tweaks in a hotfix.

## DB Change Plan (if applicable)

Not applicable (no DB changes).
