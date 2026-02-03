---
task: ops-dashboard-virtualization
timestamp_utc: 2026-02-02T21:36:52Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard List Virtualization

## Objective

Replace pagination with a virtualized full list so the ops dashboard remains smooth and fast with large booking volumes.

## Success Criteria

- [ ] Pagination removed; list scrolls continuously.
- [ ] Booking actions, filters, search, sort remain correct.
- [ ] Visible booking IDs are scoped to virtual rows for realtime toasts.
- [ ] No layout overlaps when cards expand/collapse.

## Architecture & Components

- `src/components/features/dashboard/BookingsList.tsx`
  - Switch to `useWindowVirtualizer`.
  - Remove pagination and page state.
  - Render virtual rows with measurement and scroll-smooth animations.
- `package.json`
  - Add `@tanstack/react-virtual` dependency.

## Data Flow & API Contracts

- No API changes. Realtime hook continues to consume summary cache.

## UI/UX States

- Keep empty, loading, and error states unchanged.

## Edge Cases

- Empty list must still show “No bookings found.”
- Expanded cards must re-measure to avoid overlap.
- Rapid filter/search changes should not crash the virtualizer.

## Testing Strategy

- `pnpm run typecheck`.
- Chrome DevTools MCP perf/a11y checks once env vars are available.

## Rollout

- Standard deploy; no feature flag.
