# [HIGH_BUG] Default ops create path bypasses capacity enforcement

**File:** [`src/app/api/ops/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/route.ts#L778-L1230) (lines 778, 790, 991, 1230)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-capacity-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler only uses createWithEnforcement when bookingValidationUnified is enabled. In the legacy branch it validates schedule and operating hours, then calls insertBookingRecord directly, without checkSlotAvailability or createBookingWithCapacityCheck. Since the environment defaults this feature flag to false, an authenticated restaurant member can create repeated walk-in bookings for a full slot and bypass the capacity transaction used by the public booking flow.

## Recommendation

Make capacity-enforced creation mandatory for ops bookings. If the legacy path must remain, have it call the same capacity RPC/precheck path and fail closed when capacity enforcement is unavailable.

## Revalidation

**Verdict:** fixed

`POST /api/ops/bookings` now always delegates walk-in creation to `handleUnifiedWalkInCreate`, regardless of `FEATURE_BOOKING_VALIDATION_UNIFIED`. The legacy branch that directly called `insertBookingRecord` was removed, so ops walk-ins now commit through `BookingValidationService.createWithEnforcement` and the capacity-backed create path.

Evidence: `pnpm exec vitest run tests/server/ops-bookings-create-route.test.ts` passed on 2026-05-16. The focused route regression keeps `bookingValidationUnified` false and verifies `createWithEnforcement` is called while `insertBookingRecord` is not. The combined focused command `pnpm exec vitest run tests/server/ops-bookings-create-route.test.ts tests/server/bookings-modification-flow.test.ts tests/server/inline-auto-assign.test.ts` passed, and targeted ESLint passed for the changed files.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
