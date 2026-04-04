# Continuity Ledger

Last updated: 2026-04-05T00:32:00Z

## Goal (incl. success criteria)

- Audit production for bookings affected by the BST ops-admin time-shift bug after confirming and fixing the root cause in code.
- Success: produce a read-only production result with confirmed historical hits and currently unresolved hits clearly separated.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the production audit read-only.
- Do not expose any Supabase or database secrets in task artifacts or chat.
- Production data can prove conservative bug signatures, but not every ambiguous user-intended reschedule.
- Repo-wide unrelated failures remain out of scope.

## Key decisions

- Use the Supabase management API to resolve production access rather than guessing partial production URLs from env.
- Treat an exact `-60 minute` `start_time` shift after the BST switchover as the strongest confirmed production signature.
- Separate historical hits from unresolved current rows so support has an actionable answer.

## State

- The code fix is complete locally.
- The production audit found one confirmed historical hit and zero currently unresolved confirmed hits.

## Done

- Reviewed root `AGENTS.md`, `src/app/AGENTS.md`, and the production audit constraints.
- Created `tasks/audit-production-booking-time-shift-20260404-2327/` with audit notes and findings.
- Resolved the production project ref via the Supabase management API.
- Queried production `audit_logs` and `bookings` read-only for post-BST `booking.updated` signatures.
- Confirmed one historical hit:
- `GWKJNS56MV` (`fa7139d7-bc42-4006-8646-623ac26e9100`) at The Old Crown Girton shifted from `18:30` to `17:30` on `2026-03-31T19:01:59Z`, then was corrected back to `18:30` on `2026-03-31T19:27:27Z`.
- Confirmed zero currently unresolved hits under the conservative `-60 minute start_time` signature.

## Now

- Prepare the production audit handoff.

## Next

- If ops wants a broader "likely affected" report beyond the conservative confirmed-hit list, run a second-pass audit that includes ambiguous manual reschedules and review them manually.

## Open questions (UNCONFIRMED if needed)

- None at the moment.

## Working set (files/ids/commands)

- `tasks/fix-ops-admin-booking-time-shift-20260404-2305/research.md`
- `tasks/fix-ops-admin-booking-time-shift-20260404-2305/plan.md`
- `tasks/fix-ops-admin-booking-time-shift-20260404-2305/todo.md`
- `tasks/fix-ops-admin-booking-time-shift-20260404-2305/verification.md`
- `tasks/audit-production-booking-time-shift-20260404-2327/research.md`
- `tasks/audit-production-booking-time-shift-20260404-2327/plan.md`
- `tasks/audit-production-booking-time-shift-20260404-2327/todo.md`
- `tasks/audit-production-booking-time-shift-20260404-2327/verification.md`
- `CONTINUITY.md`
- `src/app/api/ops/bookings/[id]/route.ts`
- `tests/server/ops-booking-route.test.ts`
