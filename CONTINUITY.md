# Continuity Ledger

Last updated: 2025-12-30T18:53:55Z

## Goal (incl. success criteria)

- Revamp `/floor-plan` UX/UI from scratch while preserving core behaviors.
- Success: Floor plan supports add booking + check bookings on all device sizes.
- Success: A11y and performance budgets pass with Chrome DevTools MCP evidence.

## Constraints/Assumptions

- Follow AGENTS SDLC; no coding before requirements and plan are reviewed.
- Everything is a task with `tasks/<slug>-YYYYMMDD-HHMM>/` artifacts.
- Manual UI QA via Chrome DevTools MCP required for UI changes.
- Prefer Shadcn components before custom UI.
- Scope confirmed: ops `/floor-plan` only.
- UX changes allowed; keep most existing capabilities unless removal is justified.
- Visual consistency: align with dashboard, bookings, and new-bookings pages (Shadcn base).
- Add booking action routes to `/new-bookings`.
- Browse bookings should route to `/bookings` with contextual filters (table/time) and a toggle for day vs window.
- API/contract changes allowed; add non-breaking filters if needed.
- Default nearby window size: ±90 minutes.

## Key decisions

- Start a new task folder for the revamp and complete Phase 1/2 before implementation.
- `/new-bookings` does not accept `tableId`; only pass date/time/party size context.

## State

- Phase 4 (Verification): Chrome DevTools MCP QA attempted; blocked by ops auth redirect.

## Done

- Read root and relevant AGENTS/skills guidance.
- Created task folder `tasks/floor-plan-revamp-20251230-1742/` with required stubs.
- Located floor plan-related files via code search.
- Captured requirements from user in research.md.
- Drafted plan.md with architecture, data flow, and rollout notes.
- Updated plan/research to include contextual booking filters and API changes.
- Ran Shadcn registry discovery (sheet/tabs/slider/tooltip available).
- Implemented `/bookings` table/time window filters + toggle and URL params.
- Added `tableId` filter to `GET /api/ops/bookings` and client filter plumbing.
- Rebuilt `/floor-plan` UI with Shadcn primitives, responsive inspector, and new actions.
- Attempted `pnpm dev`; validation passed but port 3000 already in use.
- Opened `/floor-plan` via Chrome DevTools MCP; redirected to ops sign-in (auth blocked).
- Captured DevTools screenshot of auth block.
- Updated task todo/verification with QA block and deviation note.

## Now

- Await ops credentials or authenticated session to complete MCP QA.

## Next

- Re-run Chrome DevTools MCP QA for `/floor-plan` and `/bookings` once authenticated.
- Run targeted lint/tests if needed.

## Open questions (UNCONFIRMED if needed)

- Need ops credentials or an authenticated session to complete UI QA. (UNCONFIRMED)

## Working set (files/ids/commands)

- CONTINUITY.md
- AGENTS.md
- src/components/AGENTS.md
- src/app/AGENTS.md
- src/components/features/seating/FloorPlanPage.tsx
- src/components/features/dashboard/TableFloorPlan.tsx
- tasks/floor-plan-revamp-20251230-1742/research.md
- tasks/floor-plan-revamp-20251230-1742/plan.md
- tasks/floor-plan-revamp-20251230-1742/todo.md
- tasks/floor-plan-revamp-20251230-1742/verification.md
- tasks/floor-plan-revamp-20251230-1742/artifacts/devtools-auth-blocked.png
