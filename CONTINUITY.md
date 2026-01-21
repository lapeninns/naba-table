# Continuity Ledger

Last updated: 2026-01-21T00:39:12Z

## Goal (incl. success criteria)

- Adjust Ops dashboard “All” bookings sort so checked-in and upcoming appear first, completed last.
- Success: Checked-in bookings sorted first, then upcoming, then completed/cancelled/no-show.
- Success: Existing filters and sort controls remain intact.

## Constraints/Assumptions

- Follow AGENTS SDLC phases; task folder required before implementation.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Supabase remote only; no local migrations/seeds.
- Keep changes focused to list ordering (no extra refactors).

## Key decisions

- Apply grouped ordering only when filter is “all”; keep sort controls within each group.

## State

- Phase 3 implementation complete for dashboard sort; build passes. Verification pending.
- CSRF cookie fix implemented in prior task; verification pending.

## Done

- Implemented grouped sort in `src/components/features/dashboard/BookingsList.tsx`.
- Fixed TypeScript type error for status sets.
- Ran `pnpm run build` successfully.

## Now

- Prepare Chrome DevTools MCP QA and update verification report.

## Next

- Run manual QA on dashboard list ordering and update `verification.md`.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- CONTINUITY.md
- src/components/features/dashboard/BookingsList.tsx
- tasks/ops-dashboard-bookings-sort-20260120-1748/verification.md
- tasks/fix-csrf-cookie-source-20260120-1728/verification.md
