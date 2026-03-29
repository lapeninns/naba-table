# Continuity Ledger

Last updated: 2026-03-29T10:36:30Z

## Goal (incl. success criteria)

- Reassign all bookings from Old School House to Old Crown in the remote Supabase project.
- Success means the source and destination restaurants are identified unambiguously, the targeted booking rows are updated safely, and before/after evidence is stored in the task folder.

## Constraints/Assumptions

- Work only in the current repo workspace.
- Supabase remains remote-only; no local DB work.
- This is a production-style data operation and still requires task artifacts, rollback notes, and evidence.
- Direct Postgres auth from `.env.vercel-production` is failing in this workspace, so production operations must use the service-role Supabase HTTP path.

## Key decisions

- Create a dedicated operational task folder before touching Supabase data.
- Treat `public.bookings.restaurant_id` as the primary field to inspect first, then verify dependent tables before executing any update.
- Capture before/after counts and the affected booking ID set so rollback is possible if needed.
- Move the isolated linked customer row with the booking because it belongs to this booking only.
- Clear venue-specific assignment state before the venue swap: table assignment, allocation, assignment idempotency, zone lock, and confirmation cache.

## State

- The Old School House to Old Crown booking move has been executed and verified.
- Task artifacts exist for `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/`.
- Old School House now has zero bookings; Old Crown has the moved booking.

## Done

- Read the root AGENTS instructions and the MCP/Continuity skills relevant to remote Supabase work.
- Located existing repo scripts for Supabase inspection and SQL execution.
- Created `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/` with research, plan, todo, and verification stubs.
- Verified live production restaurant IDs:
  - Old School House `a120da71-ba6d-446f-a33a-2e78787abcb0`
  - Old Crown `a050d1ad-1ee0-4ea0-abc2-22c3778aa52c`
- Captured preflight evidence in `artifacts/preflight.txt`.
- Moved booking `2fd69938-1e03-48c3-a776-34fa4bd3ab36` / ref `LYAGFXAT3Y` from Old School House to Old Crown.
- Moved linked customer `c120ec30-295b-4f63-bdca-c8cbaebbcece` to Old Crown because it only belonged to that booking.
- Cleared stale table assignment, allocation, assignment idempotency, zone lock, and confirmation cache state for the moved booking.
- Updated the related analytics event restaurant ID to Old Crown.
- Captured execution and postflight evidence in `artifacts/execution.txt` and `artifacts/postflight.txt`.

## Now

- Wrap up task documentation and report the completed production change to the user.

## Next

- No immediate follow-up required unless a new Old School House booking needs the same treatment.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `CONTINUITY.md`
- `AGENTS.md`
- `tasks/move-old-school-house-bookings-to-old-crown-20260329-0720/`
- `scripts/debug-restaurants.ts`
- `scripts/execute-sql.ts`
- `scripts/purge-restaurant-bookings.ts`
- `types/supabase.ts`
- `.env.vercel-production`
- production service-role Supabase queries via inline `pnpm -s tsx`
