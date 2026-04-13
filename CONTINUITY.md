# Continuity Ledger

Last updated: 2026-04-13T17:58:00Z

## Goal (incl. success criteria)

- Fix the reservation wizard restaurant-context regression for slug-based guest booking flows.
- Success: slug-based bookings can build a draft and submit without relying on deprecated default-restaurant env values.
- Success: the wizard continues hydrating `restaurantId` into state when only the restaurant slug is initially known.
- Success: regression coverage proves the client contract matches the booking API boundary.

## Constraints/Assumptions

- Follow root `AGENTS.md`, `reserve/AGENTS.md`, and repo task-artifact requirements.
- Manual UI QA via Chrome DevTools MCP is required before closing because this touches the guest booking wizard.
- The booking API contract (`restaurantId` or `restaurantSlug`) is the source of truth for client draft validation.

## Key decisions

- Fix the regression in the canonical wizard flow instead of restoring default-restaurant fallbacks.
- Align `buildReservationDraft()` with the booking API boundary by allowing either restaurant id or slug.
- Keep venue hydration running until `restaurantId` is present so downstream paths like timeout recovery still benefit from a concrete id.

## State

- Implementation and automated verification are complete for `tasks/fix-wizard-restaurant-context-20260413-1650/`.
- Browser verification was attempted but blocked by missing Next.js env vars and a standalone reserve-app route error; blocker evidence is recorded in the task artifacts.

## Done

- Created `tasks/fix-wizard-restaurant-context-20260413-1650/` with research, plan, todo, verification, and artifact notes.
- Updated `buildReservationDraft()` to accept either `restaurantId` or `restaurantSlug`, matching the booking API contract.
- Tightened slug-based venue hydration so the wizard continues fetching venue data until `restaurantId` is present.
- Added regression coverage for slug-only draft building and the both-identifiers-missing failure.
- Ran focused Vitest, TypeScript, and ESLint verification successfully.
- Attempted Chrome DevTools MCP verification through both `pnpm dev` and `pnpm reserve:dev`, and captured the blockers in task artifacts.

## Now

- Preparing the final summary for the user.

## Next

- Re-run browser proof once the required env vars are available or the standalone reserve route error is resolved.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/tasks/fix-wizard-restaurant-context-20260413-1650/research.md
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/tasks/fix-wizard-restaurant-context-20260413-1650/plan.md
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/tasks/fix-wizard-restaurant-context-20260413-1650/todo.md
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/tasks/fix-wizard-restaurant-context-20260413-1650/verification.md
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/reserve/features/reservations/wizard/model/transformers.ts
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/reserve/features/reservations/wizard/hooks/useReservationWizard.ts
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/tests/reserve/buildReservationDraft.test.ts
- /Users/amankumarshrestha/.codex/worktrees/377f/nabatableLP/src/app/api/bookings/route.ts
