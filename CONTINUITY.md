# Continuity Ledger

Last updated: 2026-01-14T23:38:47Z

## Goal (incl. success criteria)

- Fix ops booking timezone inconsistency: ops list + booking detail show same start/end across devices by deriving fallback ISO using restaurant timezone.
- Complete task folder `tasks/fix-ops-booking-timezone-20260113-2218/` (todo + verification updated; tests passing).

## Constraints/Assumptions

- Must follow `/AGENTS.md` SDLC/task-folder workflow; no secrets.
- Scope: ops-only (guest normalization out of scope unless requested).
- When `start_at`/`end_at` are null, treat `booking_date` + `start_time`/`end_time` as restaurant-local wall time.
- Preserve API contract: `startIso`/`endIso` remain UTC ISO strings.

## Key decisions

- Use Luxon `DateTime.fromISO(..., { zone })` + `.toUTC().toISO()` for ops route fallback ISO generation.
- Remove device-local date comparisons in ops booking helpers (Luxon + explicit timezone).

## State

- Working on `fix-ops-booking-timezone-20260113-2218` (Phase 3 implementation).

## Done

- Reviewed task docs in `tasks/fix-ops-booking-timezone-20260113-2218/`.
- Located timezone-unsafe fallbacks in:
  - `src/app/api/ops/bookings/route.ts`
  - `src/app/api/ops/bookings/[id]/route.ts`
- Located tests to extend:
  - `src/app/api/ops/bookings/route.test.ts`
  - `src/app/api/ops/bookings/[id]/route.test.ts`
- Found device-local date logic in `components/dashboard/BookingRow.tsx`.

## Now

- Patch ops API fallback ISO generation + extend tests.

## Next

- Audit ops UI for remaining timezone-unsafe formatting; patch as needed.
- Run tests; save logs under `tasks/fix-ops-booking-timezone-20260113-2218/artifacts/`.
- Update `todo.md` and `verification.md` checklists.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- Task: `tasks/fix-ops-booking-timezone-20260113-2218/`
- Routes: `src/app/api/ops/bookings/route.ts`, `src/app/api/ops/bookings/[id]/route.ts`
- UI helper: `components/dashboard/BookingRow.tsx`
- Tests: `src/app/api/ops/bookings/route.test.ts`, `src/app/api/ops/bookings/[id]/route.test.ts`
- Commands: `pnpm test` (or `pnpm vitest`)
