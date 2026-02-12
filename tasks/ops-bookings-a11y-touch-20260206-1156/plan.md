---
task: ops-bookings-a11y-touch
timestamp_utc: 2026-02-06T11:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Bookings A11y + Touch Targets

## Objective

Improve `/app/bookings` list UX and accessibility by:

- Raising mobile touch targets to WCAG-friendly sizing (>= 44x44).
- Ensuring search inputs are consistent and mobile-safe (16px on mobile).
- Keeping offline/sync banner visible during scroll.
- Adding keyboard/AT affordances (skip link, aria-live summary).

## Success Criteria

- [ ] Primary taps in the list are >= 44x44 on a 375px viewport.
- [ ] Search input uses 16px font on mobile and does not trigger iOS zoom.
- [ ] Offline banner remains visible while scrolling bookings.
- [ ] Skip link works and focuses the list region.
- [ ] No desktop regression: spacing and density remain appropriate at >= 1280px.

## Scope / Files

- Touch targets:
  - `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`
  - `src/components/features/dashboard/cards/OpsBookingCardHeader.tsx`
  - `components/dashboard/StatusFilterGroup.tsx`
  - `src/components/features/bookings/OpsStatusFilter.tsx`
- Shared search component:
  - `src/components/features/bookings/components/OpsBookingsSearchInput.tsx` (new)
  - `components/dashboard/BookingsHeader.tsx`
  - `src/components/features/bookings/OpsBookingsClient.tsx`
- Sticky offline banner:
  - `src/components/features/bookings/OpsBookingsClient.tsx`
- Skip link + list target + aria-live:
  - `src/components/features/bookings/OpsBookingsClient.tsx`
  - `components/dashboard/BookingsTable.tsx`

## Testing

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Targeted UI smoke via DevTools MCP after PRs are complete.
