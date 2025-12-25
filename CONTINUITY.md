# Continuity Ledger

Last updated: 2025-12-25T23:28:37Z

## Goal (incl. success criteria)

- Enable guests to edit their own bookings end-to-end (guest-facing self-serve) for date/time/party/notes.

## Constraints/Assumptions

- Follow AGENTS SDLC; no coding before requirements & plan are reviewed.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Supabase remote-only if DB changes are needed.
- Nested AGENTS apply for `src/app`, `src/components`, `src/hooks`.

## Key decisions

- Allow edits for logged-in guests OR via recovery link; ownership by email or auth_user_id.
- Keep pending lock and past booking blocks.
- No feature flag.

## State

- Phase 3 implementation in progress (API + tests updated). UI verification pending.

## Done

- Updated `tasks/guest-booking-self-edit-20251225-2328/research.md` with confirmed requirements.
- Drafted `tasks/guest-booking-self-edit-20251225-2328/plan.md`.
- Added ownership check helper and updated dashboard update authorization in `src/app/api/bookings/[id]/route.ts`.
- Added/updated PUT tests in `src/app/api/bookings/[id]/route.test.ts`.
- Updated `tasks/guest-booking-self-edit-20251225-2328/todo.md`.

## Now

- Review code changes and consider running tests / manual QA plan.

## Next

- Run relevant tests (at least `src/app/api/bookings/[id]/route.test.ts`).
- Perform Chrome DevTools MCP manual QA for guest edit flow and update `verification.md`.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `src/app/api/bookings/[id]/route.ts`
- `src/app/api/bookings/[id]/route.test.ts`
- `tasks/guest-booking-self-edit-20251225-2328/`
