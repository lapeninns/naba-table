# Continuity Ledger

Last updated: 2026-02-03T00:28:26Z

## Goal (incl. success criteria)

- Fix flicker and improve scroll smoothness on Ops Customers, Ops Bookings, Ops Dashboard lists.
- Ensure `/app` redirects to ops sign-in (`/app/auth/signin`).

## Constraints/Assumptions

- Follow AGENTS.md SDLC; task folder with artifacts.
- Chrome DevTools MCP QA required for UI changes.
- Keep changes focused; no extra abstractions.

## Key decisions

- Use Motion opacity-only transitions on list containers (initial mount only).
- Avoid Motion on per-row virtualized items; use translate3d and will-change.
- Disable virtualization for short lists; keep for large lists/paged.
- Standardize ops auth redirects to `/app/auth/signin`.

## State

- Code changes applied; lint warnings fixed; UI QA still blocked by auth for list pages.

## Done

- Installed `motion` dependency.
- Updated CustomersTable, BookingsList, BookingsTable with Motion container + short-list render path.
- Reduced per-row Motion usage for smoother scroll.
- Standardized ops auth redirects to `/app/auth/signin`.
- Fixed lint warnings in OpsBookingsClient, OpsCustomersClient, OpsDashboardClient.
- Verified `/app` redirects to `/app/auth/signin` via DevTools MCP.

## Now

- Awaiting ops auth access to complete UI QA for scroll smoothness.

## Next

- Run Chrome DevTools MCP QA on customers/bookings/dashboard once authenticated.
- Update `verification.md` with results.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `src/components/features/customers/CustomersTable.tsx`
- `src/components/features/dashboard/BookingsList.tsx`
- `components/dashboard/BookingsTable.tsx`
- `src/components/features/bookings/OpsBookingsClient.tsx`
- `src/components/features/customers/OpsCustomersClient.tsx`
- `src/components/features/dashboard/OpsDashboardClient.tsx`
- `src/app/app/(app)/layout.tsx`
- `src/app/app/(app)/new-bookings/page.tsx`
- `src/app/app/(app)/settings/restaurant/layout.tsx`
- `src/app/app/(app)/settings/tables/page.tsx`
- `tasks/fix-list-flicker-20260202-2349/*`
