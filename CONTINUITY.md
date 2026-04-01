# Continuity Ledger

Last updated: 2026-04-01T16:28:00Z

## Goal (incl. success criteria)

- Fix customer phone normalization so equivalent UK formats such as `+44...`, `44...`, and `0...` resolve to the same customer across ops and public booking flows.
- Success: `upsertCustomer` reuses existing customers for equivalent UK phone formats instead of attempting duplicate inserts.
- Success: focused automated proof covers normalization, timeout recovery, and duplicate-collision regression paths.

## Constraints/Assumptions

- Follow existing AGENTS SDLC flow with task artifacts.
- Keep the fix on the canonical customer/upsert path in `server/customers.ts`.
- Reuse a shared comparable-phone helper in `reserve/shared/validation/contact.ts`.
- Preserve a safe digits-only fallback for non-UK numbers in this pass.

## Key decisions

- Treat this as a verification-first regression fix because the production mismatch had to be confirmed first.
- Normalize valid UK numbers to E.164 digits-without-plus before lookup and comparison.
- Keep non-UK normalization as a digits-only fallback to avoid widening the scope of phone-policy changes.
- Apply the same comparable-phone rule to reserve timeout recovery and guest self-serve booking ownership checks.

## State

- Phase 4: broader phone-normalization audit and focused verification complete for the current booking-flow pass.

## Done

- Confirmed the production error hits the ops host and canonical ops bookings route.
- Traced the duplicate collision to `server/customers.ts`, where lookup and insert normalize UK phone values differently.
- Created task folder `tasks/fix-customer-phone-normalization-20260401-1611/` with research, plan, todo, and verification stubs.
- Updated `server/customers.ts` so valid UK numbers normalize to canonical E.164 digits-without-plus before lookup and comparison.
- Added `reserve/shared/validation/contact.ts::normalizeComparablePhone` and reused it in reserve timeout recovery.
- Updated guest self-serve booking update ownership checks to compare normalized phone values.
- Added `tests/server/customers.test.ts` covering equivalent UK formats and existing-customer reuse.
- Added `tests/reserve/timeoutRecovery.test.ts` covering equivalent UK phone matching after timeout recovery.
- Verified with `npx vitest run tests/server/customers.test.ts tests/reserve/timeoutRecovery.test.ts` and `pnpm typecheck`.

## Now

- Ready to hand off or expand verification if production logs need follow-up after deploy.

## Next

- Monitor post-deploy ops booking logs for disappearance of `customers_restaurant_id_phone_normalized_key` errors.
- Follow up separately on `waiting_list.customer_phone` exact-string storage if waitlist duplicates are in scope.

## Open questions (UNCONFIRMED if needed)

- None.

## Working set (files/ids/commands)

- `tasks/fix-customer-phone-normalization-20260401-1611/research.md`
- `tasks/fix-customer-phone-normalization-20260401-1611/plan.md`
- `tasks/fix-customer-phone-normalization-20260401-1611/todo.md`
- `tasks/fix-customer-phone-normalization-20260401-1611/verification.md`
- `CONTINUITY.md`
- `server/customers.ts`
- `reserve/shared/validation/contact.ts`
- `reserve/features/reservations/wizard/utils/timeoutRecovery.ts`
- `src/app/api/bookings/[id]/route.ts`
- `reserve/shared/validation/contact.ts`
- `src/app/api/ops/bookings/route.ts`
- `src/app/api/bookings/route.ts`
- `tests/server/customers.test.ts`
- `tests/reserve/timeoutRecovery.test.ts`
- `npx vitest run tests/server/customers.test.ts tests/reserve/timeoutRecovery.test.ts`
- `pnpm typecheck`
