# Continuity Ledger

Last updated: 2026-03-29T22:43:30Z

## Goal (incl. success criteria)

- Build the canonical Ops booking card view-model and policy layer.
- Success: builder returns grouped `header` / `details` / `actions` / `meta` / `booking` submodels.
- Success: guest identity, labels, table state, urgency, footer completion label, and action policy are normalized in one place.
- Success: selector input scope stays unchanged except for feeding the richer row model.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Use prompt constraints exactly: Walk-in Guest fallback, initials from normalized label, no urgency for done or checked-in bookings, canonical table state of `assigned` / `unassigned` / `not_applicable`.
- Keep changes in the canonical card builder path; avoid duplicate policy logic in card components.
- UI verification via Chrome DevTools MCP is required if UI behavior changes materially.

## Key decisions

- Treat the user prompt as the authoritative plan constraints because no checked-in task plan with the exact requested language exists in the repo.
- Update both card-builder call sites (`opsBookingsSelectors` and `BookingsListVirtualized`) so the richer contract is canonical across bookings list and dashboard.
- Move per-component action/table/footer derivation into the shared builder to keep one source of truth.

## State

- Phase 4: implementation and automated verification complete; branch-specific DevTools QA blocked by local runtime state.

## Done

- Located current card builder, selector, dashboard consumer, and related tests.
- Reviewed root and component-level AGENTS rules plus continuity/style skills.
- Implemented canonical grouped card submodels and moved display/action policy into `opsBookingCardUtils.ts`.
- Updated card consumers and focused tests for the richer contract.
- Ran targeted Vitest suite and full TypeScript typecheck successfully.

## Now

- Recording verification outcomes and the DevTools blocker in task artifacts.

## Next

- If branch-specific browser QA is needed immediately, clear the stale `.next/dev/lock` or start this worktree on an isolated dev runtime.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `src/components/features/dashboard/cards/opsBookingCardUtils.ts`
- `src/components/features/dashboard/cards/OpsBookingCard.tsx`
- `src/components/features/dashboard/cards/OpsBookingCardHeader.tsx`
- `src/components/features/dashboard/cards/OpsBookingCardDetails.tsx`
- `src/components/features/dashboard/cards/OpsBookingCardActions.tsx`
- `src/components/features/bookings/opsBookingsSelectors.ts`
- `src/components/features/dashboard/list/BookingsListVirtualized.tsx`
- `tests/components/OpsBookingCardViewModel.test.ts`
- `tests/components/features/bookings/opsBookingsSelectors.test.ts`
- `tests/components/OpsBookingCardActions.noShow.test.tsx`
