---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T13:50:00Z
owner: github:@factory-droid
reviewers:
  - github:@maintainers
risk: high
flags: []
related_tickets: []
---

# Research: Guest-Facing Public Routes Revamp

## Requirements

- **Functional**
  - Redesign every public guest-facing page (routes tagged `groups: ["public"]` in `route-map.json`) according to the `DesignSystem.md` tokens/templates.
  - Prioritize the “public categories” first: `/restaurants`, `/restaurants/[slug]`, `/restaurants/[slug]/book`, `/restaurants/[slug]/book/thank-you`, `/restaurants/[slug]/thank-you`, plus auth entry `/auth/signin` if needed for coherence.
  - Maintain deep-link compatibility (URL params, dynamic segments) and ensure new components still surface booking states.
- **Non-functional**
  - Align with `MarketingLayout` + `.guest-theme`, ensuring new sections reuse the design system spacing, radii, and focus tokens.
  - Preserve SEO metadata + existing dynamic configuration (e.g., `force-dynamic` where defined).
  - Keep pages responsive and accessible (keyboard focus, ARIA, semantics) and ensure load/perf budgets stay within spec.

## Existing Patterns & Reuse

- The revamp for `/` now leverages `src/components/design-system/homepage.tsx`; similar approach can be extended by creating dedicated section components per page under `src/components/design-system/public/` (e.g., list, detail, booking steps).
- `DesignSystem.md` provides atoms/molecules (NavBar, MetricTile, DataTable, ProfileCard, SearchBar) we can adapt for list/detail flows.
- Many `restaurants` pages likely already use `components/guest` or `components/features/booking`; we should inspect these to reuse logic while restyling.

## External Resources

- [`DesignSystem.md`](../DesignSystem.md) — tokens + component patterns we must follow.
- `route-map.json` — authoritative mapping of routes per group for scope validation.

## Constraints & Risks

- **Scope breadth**: “all guest facing pages” includes dynamic segments for bookings; ensure staged rollout (public marketing first) to avoid regressions in booking flows.
- **Dynamic data**: Some public routes fetch data server-side; refactors must avoid breaking loaders or caches.
- **Time**: Multi-page revamp requires incremental delivery; keep each page modular for easier QA.
- **MCP requirement**: Each UI surface ultimately needs Chrome DevTools audit; plan for artifact capture.

## Open Questions (owner, due)

- Should `/auth/signin` adopt the same marketing shell or use `AuthLayout` with design tokens? (owner: github:@factory-droid, due before implementation)
- For dynamic restaurant detail pages, confirm whether we can introduce new components without altering data contract. (owner: github:@factory-droid, due before coding detail page)

## Recommended Direction (with rationale)

- Create a `design-system/public` component suite (list hero, filters, detail tabs, booking timeline) mirroring the spec to keep styles consistent and localized.
- Tackle public routes sequentially starting with `/restaurants` list page (category aggregator), then `/restaurants/[slug]` detail, followed by `/restaurants/[slug]/book` and downstream thank-you surfaces.
- Each page module should compose 2–4 semantic sections: hero, filters/search, proof/testimonials, CTA; reuse tokens for colors/spacing to ensure cohesive revamp.

## Appendix — DesignSystem Compliance Audit

| Route                                                  | File                                                                                                                          | DesignSystem components used                                                                                   | Legacy components remaining                                                     | Action needed                                                                               |
| :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| `/`                                                    | `src/app/(public)/page.tsx`                                                                                                   | `HomeHeroSection`, `HomeMetricsSection`, `HomeJourneySection`, `HomeCTASection`                                | —                                                                               | None                                                                                        |
| `/restaurants`                                         | `src/app/(public)/(marketing)/restaurants/page.tsx`                                                                           | `RestaurantsHeroSection`, `RestaurantsGridSection`                                                             | Wrapper still uses legacy `.guest-theme` utility                                | Optional: migrate layout chrome to a DS layout helper                                       |
| `/restaurants/[slug]`                                  | `src/app/(public)/(marketing)/restaurants/[slug]/page.tsx`                                                                    | `RestaurantDetailHero`, `RestaurantDetailsSection`                                                             | —                                                                               | None                                                                                        |
| `/restaurants/[slug]/book`                             | `src/app/(public)/(marketing)/restaurants/[slug]/book/page.tsx`                                                               | `RestaurantBookingShell`                                                                                       | `ReservationWizardClient` downstream still renders legacy `Guest*` wizard panes | Build DS-compliant booking wizard primitives or wrap wizard in DS surface                   |
| `/restaurants/[slug]/book/thank-you`                   | `src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page.tsx`                                                     | `ReservationThankYouCard`                                                                                      | —                                                                               | None                                                                                        |
| `/bookings/[bookingId]`, `/guest/bookings/[bookingId]` | `src/app/(public)/bookings/[bookingId]/page.tsx`, `src/app/guest/bookings/[bookingId]/page.tsx` via `ReservationDetailClient` | `BookingDetailShell`, `BookingSummaryCard`, `DetailStatCard`, `InfoPanel`, `ManageBookingPanel`, `InlineAlert` | —                                                                               | None                                                                                        |
| `/guest/bookings/[bookingId]/receipt`                  | `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx`                                                                | —                                                                                                              | `GuestHero`, `GuestCard`, `GuestSection`, `GuestStatus`                         | Rebuild receipt using `BookingDetailShell` + `DetailStatCard` and DS call-to-action buttons |
| `/guest/dashboard`                                     | `src/app/guest/dashboard/page.tsx` + `src/components/features/guest/dashboard/GuestDashboardClient.tsx`                       | —                                                                                                              | Heavy use of `GuestSection`, `GuestCard`, bespoke gradients                     | Design DS dashboard hero, quick-action tiles, list rows to replace legacy components        |
| `/guest/bookings`                                      | `src/app/guest/bookings/page.tsx` + `src/components/features/booking/list/BookingListClient.tsx`                              | —                                                                                                              | `GuestSection`, `GuestCard`, legacy tabs/buttons                                | Introduce DS booking list grid + tab primitives, reuse DS badges/buttons                    |
| `/guest/profile`                                       | `src/app/guest/profile/page.tsx` + `src/guest/routes/profile/page-view.tsx`                                                   | —                                                                                                              | Custom `.guest-icon-box`, ad-hoc cards                                          | Provide DS profile layout (hero, stats, form shell)                                         |
| `/auth/signin`                                         | `src/app/(public)/auth/signin/page.tsx`                                                                                       | —                                                                                                              | Hand-written hero + card using raw Tailwind + `GuestSignInForm`                 | Create DS auth hero/card primitives or wrap in `AuthLayout` variant using DS tokens         |
| `/guest/thank-you`                                     | `src/app/guest/thank-you/page.tsx`                                                                                            | N/A (redirect)                                                                                                 | N/A                                                                             | No action                                                                                   |

### Follow-ups & Blockers

- **Booking flows**: `ReservationWizardClient` still renders the legacy wizard; add DS-compatible stepper, timeline, and summary cards before marketing new booking shells.
- **Shared primitives**: Newly added `BookingDetailShell`/`BookingSummaryCard` should be ported to `ReceiptClient` to eliminate duplicated legacy `GuestCard` markup.
- **Portal surfaces**: Dashboard, bookings list, and profile screens lack any DS primitives; need a `design-system/guest` package covering hero sections, tab collections, and icon tiles to replace `GuestSection`, `GuestCard`, and `.guest-icon-box` helpers.
