---
task: guest-ui-redesign
timestamp_utc: 2025-12-03T20:35:40Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Implementation Plan: Guest UI Redesign

## Objective

Deliver a cohesive, modern, mobile-first redesign for **all guest-facing routes** (public marketing + authenticated guest app), preserving existing flows while improving clarity, accessibility, and performance.

## Success Criteria

- [ ] Single design system (tokens for color/typography/spacing, component variants) applied across marketing + guest app.
- [ ] Navigation and primary actions are keyboard- and screen-reader-accessible; pointer targets ≥24px; focus is visible and ordered.
- [ ] Key pages meet perf budgets on mobile throttling (FCP ≤2.0s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms).
- [ ] Critical flows (restaurant booking, booking manage/cancel, guest dashboard/bookings/profile) retain existing functionality with no broken deep links.
- [ ] Lighthouse + DevTools MCP artifacts captured for representative pages (marketing home, booking wizard, guest dashboard, booking detail).

## Architecture & Components

- **Design tokens/theme**
  - Define primary/neutral palette, typography scale, spacing grid, radius, shadow tokens in `globals.css` (or theme file) applied to Shadcn components.
  - Introduce reusable section spacing utilities and max-width containers for consistency.
- **Shells & layout**
  - Marketing shell for `(public)` routes with hero, section stacking, sticky header variant; guest shell for `/guest/**` with authenticated nav, breadcrumb/title area, contextual actions, and consistent gutters.
  - Reuse `Header` and `Footer` by retheming props/variants; centralize nav links/CTA config.
- **Page templates**
  - **List + filters**: restaurants page, bookings list; consistent filter bar, empty/loader cards.
  - **Detail + action rail**: restaurant detail, booking detail/manage, receipt.
  - **Wizard**: booking wizard (stepper, progress, inline validation, summary card).
  - **Confirmation/thank-you**: receipt/thank-you pages with next steps + share/print.
  - **Profile/settings**: form layout with sticky save bar and inline error summaries.
- **Shared components**
  - CTA buttons, chips/badges, cards, timeline/steps, info banners, toast patterns (aria-live).
  - Loading skeletons for list/detail/wizard; empty states with illustration placeholders.
  - Responsive grid helpers (1-col mobile → 2/3-col desktop) to reduce custom CSS.
- **Data wiring**
  - Keep data fetching via existing services/hooks; ensure server components wrap client bits with `Suspense` and sane fallbacks.
  - Centralize date/time/party-size formatting helpers to keep copies in one place.

## Data Flow & API Contracts

- Reuse existing route handlers (`src/app/api/**`) and services (`src/services/ops`, `server/restaurants/*`); **no schema changes** planned.
- Booking wizard continues to load availability via existing endpoints; responses mapped into new UI shape only.
- Auth redirects remain: unauthenticated users hitting `/guest/**` should be redirected to `/auth/signin?redirectedFrom=…`.
- Manage/receipt pages must accept existing URL params (`bookingId`, `slug`) without breaking deep links.

## UI/UX States

- **Loading**: skeletons per template (list cards, detail hero, wizard sidebar) with reduced-motion fade.
- **Empty**: descriptive copy + primary CTA; secondary link to restart booking/dashboard.
- **Error**: inline banners for recoverable errors, full-page error for fatal with retry + support link.
- **Success**: confirmation modules with key details (time/date/party, restaurant, actions: modify, cancel, directions, add to calendar).
- **Validation**: inline errors near inputs, summary at top for long forms; focus first invalid field.

## Edge Cases

- Booking not found/expired/canceled; show neutral state with CTA to create new booking.
- Unauthorized access to guest routes; graceful redirect preserving intended URL.
- Network failure during booking mutation; retain form state, allow retry, surface contact info.
- Large/slow images on marketing pages; use reserved aspect-ratio and priority hints.
- Timezone differences in booking timestamps; ensure display uses restaurant TZ where available.

## Testing Strategy

- Unit: critical shared components (wizard stepper, booking cards, form validation helpers).
- Integration: booking wizard happy/error paths; booking manage (cancel/modify) flows; profile update flow.
- Visual/a11y: run axe/Lighthouse via Chrome DevTools MCP on marketing home, booking wizard, guest dashboard, booking detail.
- Regression: verify redirects for unauthenticated users on `/guest/**`; check deep links `/bookings/[id]/manage` and `/guest/bookings/[id]/receipt`.

## Rollout

- Feature flag `feat.guest.ui` guarding new layouts/components; progressive enablement:
  1. Marketing pages.
  2. Public booking wizard + thank-you.
  3. Authenticated guest dashboard/bookings/profile.
- Monitoring: track error rates for booking mutations and page load metrics; add temporary logging around booking manage actions.
- Kill-switch: disable flag to revert to current UI; keep old components until rollout complete.

## DB Change Plan

- No DB/schema changes in this task; Supabase remains remote-only.
