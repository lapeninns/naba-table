# Continuity Ledger

Last updated: 2026-04-13T15:15:00Z

## Goal (incl. success criteria)

- Fix guest booking capacity handling so `POST /api/bookings` pre-checks availability before the atomic create step and returns alternatives on capacity failures.
- Success: shared capacity availability logic is real, not stubbed.
- Success: guests receive `409` responses with alternatives for pre-check capacity failures and atomic race conflicts.
- Success: the real public booking wizard renders alternatives from the canonical route response and can recover to a successful nearby slot against staging-backed data.

## Constraints/Assumptions

- Follow root `AGENTS.md`, `server/AGENTS.md`, and `src/app/AGENTS.md`.
- Keep idempotent retry behavior intact, so customer/idempotency resolution stays ahead of the new pre-check.
- Staging currently has no explicit `restaurant_capacity_rules`, so production-like verification needs a fallback to active `table_inventory` totals.
- Real browser verification may require synthetic staging contention seeded directly in the database to avoid guest-side side effects during setup.

## Key decisions

- Centralize real availability and alternative-slot evaluation in `server/capacity/service.ts`.
- Reuse the shared availability response shape from `/api/availability` for guest booking alternatives.
- Return race-safe `BOOKING_CONFLICT` outcomes as guest-facing `409` responses with retry guidance and alternatives.
- Preserve the reserve wizard’s simple `error` string for existing flows, but add structured submission-error state so the real review step can render alternatives and retry hints.
- When explicit capacity rules are absent, derive capacity from active table inventory and evaluate overlap by booking interval rather than treating an entire service period as one bucket.

## State

- Implementation is in place for `tasks/booking-capacity-precheck-20260413-1355/`.
- Verified locally:
  - `pnpm vitest run tests/server/public-bookings-route.test.ts` passed
  - `pnpm vitest run tests/reserve/api-client.test.ts tests/reserve/review-step-capacity-error.test.tsx` passed
  - `pnpm typecheck` passed
- Chrome DevTools MCP proof completed on `/dev/guest-booking-capacity` with desktop + mobile screenshots and no console errors.
- Chrome DevTools MCP proof completed on the real public route `/restaurants/the-old-crown-girton/book` against staging-backed data:
  - `19:00` dinner slot returned `409 CAPACITY_EXCEEDED` with alternatives
  - clicking `20:30` from the alert prefilled the plan step
  - the `20:30` booking completed successfully
- Scripted request timings against the same local route:
  - `409` failure path at `19:00`: ~2188ms
  - `201` success path at `21:00`: ~8780ms

## Done

- Created and updated `tasks/booking-capacity-precheck-20260413-1355/` with research, plan, checklist, and verification notes.
- Replaced the shared capacity-service stub with real availability and alternative-slot logic.
- Wired `src/app/api/bookings/route.ts` to pre-check capacity before the atomic create step and return alternatives for capacity/race failures.
- Added focused public booking route tests for pre-check and unified/race failure behavior.
- Added a dev-only guest capacity harness for browser proof with mock alternatives and mock table availability.
- Wired the real reserve review step to display alternative slots from the canonical booking error response.
- Added staging-backed verification data under seed tag `CAPCHECK-20260413` for `the-old-crown-girton` on `2026-04-15 19:00`.

## Now

- Summarizing the production-like results for handoff.

## Next

- Commit the booking capacity pre-check change set when ready.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-capacity-precheck-20260413-1355/research.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-capacity-precheck-20260413-1355/plan.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-capacity-precheck-20260413-1355/todo.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tasks/booking-capacity-precheck-20260413-1355/verification.md
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/api/bookings/route.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/dev/guest-booking-capacity/page.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/src/app/(public)/dev/guest-booking-capacity/ui/GuestBookingCapacityDevHarness.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/capacity/service.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/capacity/types.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/server/booking/serviceFactory.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/server/public-bookings-route.test.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/shared/error/bookingSubmissionError.ts
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx
- /Users/amankumarshrestha/LapenInns Project/nabatableLP/tests/reserve/review-step-capacity-error.test.tsx
