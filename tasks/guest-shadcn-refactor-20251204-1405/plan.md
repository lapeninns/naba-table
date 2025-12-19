---
task: guest-shadcn-refactor
timestamp_utc: 2025-12-04T14:05:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest UI Shadcn Re-base

## Objective

Rebuild guest-facing UI components on Shadcn primitives + thin wrappers while preserving existing flows, data wiring, and accessibility.

## Success Criteria

- [ ] No route/flow changes; logic and redirects remain intact.
- [ ] All targeted components render using Shadcn primitives (or wrappers) with consistent tokens.
- [ ] A11y: keyboard nav + focus visible; status messages use proper `aria-live`; no new axe serious issues.
- [ ] Perf: no new CLS; lighthouse perf/a11y within existing budgets.

## Architecture & Components

- **Wrapper layer (new under `src/components/guest/ui`)**
  - `GuestSection`, `GuestHero`, `GuestCard`, `GuestStat`, `GuestStatus`, `GuestEmpty`, `GuestError`.
  - Build from Shadcn `Card`, `Badge`, `Button`, `Alert`, `Tabs`, `DropdownMenu`, `Dialog`, `Sheet`, `Avatar`.
- **Navigation**
  - Refactor `CustomerNavbar` to use Shadcn `NavigationMenu/Sheet/DropdownMenu/Avatar` while keeping sign-out/query-cache logic.
  - `MarketingLayout`/`GuestLayout` reuse wrappers; keep feature flag behavior.
- **Pages**
  - `/` landing hero/sections -> wrappers.
  - `/restaurants` list cards -> `GuestCard` + `Badge`.
  - `/restaurants/[slug]` detail CTA -> wrappers; keep map iframe.
  - Booking wizard host page uses existing dynamic import; adjust container shell only.
  - `/auth/signin` form -> Shadcn `Form`, `Alert`, `Card`.
  - Thank-you pages -> `GuestCard` + `Button`.
  - `/guest/bookings` list -> `Tabs`, `Card`, `DropdownMenu`, `Badge`.
  - `/guest/bookings/[bookingId]` detail -> `Card`, `Badge`, `Dialog`, `Button`.
  - `/guest/dashboard` hero + cards -> wrappers.
  - `/guest/profile` form -> Shadcn `Form`, `Alert`, `Card`, `Button`, `Avatar`.

## Data Flow & API Contracts

- No API contract changes. Components continue consuming hooks/services (`useBookings`, `useProfile`, `useReservation`, `useSupabaseSession`, `reservationKeys`, etc.).
- Maintain query prefetch in server components; client components remain pure presentational+hook consumers.

## UI/UX States

- Loading skeletons via Shadcn `Skeleton`.
- Empty/error via shared `GuestEmpty`/`GuestError`.
- Success/confirmation via `GuestStatus` (alert-style).

## Edge Cases

- Unauthenticated redirects stay unchanged.
- Booking detail token-or-auth access must still render.
- Wizard lazy loading fallback stays minimal and accessible (`role="status"`).
- Map iframe optional; fallback gradient retained.

## Testing Strategy

- Unit/spot checks where feasible for wrappers.
- Manual QA: keyboard nav, focus, aria-live messages on auth form, booking list/detail, profile form.
- Lighthouse + axe via Chrome DevTools MCP on `/`, `/guest/bookings`, `/guest/bookings/[id]`, `/auth/signin`.

## Rollout

- No feature flag introduced; ship as cohesive UI refresh.
- Monitor error logs and user reports; rollback path is git revert of UI-only changes.

## DB Change Plan

- Not applicable (UI-only).
