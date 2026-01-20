# Continuity Ledger

Last updated: 2026-01-20T09:05:20Z

## Goal (incl. success criteria)

- Make guest app typography consistent using shared guest theme utilities.
- Success: guest dashboard/profile/bookings + booking receipt components aligned to the same typography scale.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; task folder required.
- UI changes require Chrome DevTools MCP QA + artifacts.
- Keep scope limited to guest app typography (no unrelated UX changes).

## Key decisions

- Standardize on guest theme utilities (`heading-hero`, `heading-page`, `heading-section`, `heading-subsection`, `text-body-warm`) backed by guest tokens.

## State

- Production and staging migration lists retrieved; currently identical.

## Done

- Updated guest typography utilities with token-based sizes and balanced wrapping.
- Aligned guest primitives and guest-facing components (dashboard/profile/bookings/receipt) to shared heading/body utilities.
- Ran DevTools MCP QA on guest routes; captured screenshots.
- Queried production migration list with Supabase CLI.
- Attempted staging migration list; failed with network route error.

## Now

- Identify missing restaurant_capacity_rules table/migration causing booking RPC error.
- Determine which local migrations are unapplied on production.
- Resolve staging migration list using session pooler or other IPv4 endpoint.

## Next

- Ask for staging session pooler connection string (port 5432) to retry migration list.
- Run Lighthouse + HAR if required.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `styles/themes/guest-enhanced.css`
- `src/components/guest/ui/GuestPrimitives.tsx`
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx`
- `src/components/features/guest/profile/GuestProfileClient.tsx`
- `src/components/features/booking/list/BookingListClient.tsx`
- `src/components/features/booking/ui/BookingComponents.tsx`
- `src/app/guest/error.tsx`
- `tasks/guest-typography-consistency-20260119-2350/verification.md`
