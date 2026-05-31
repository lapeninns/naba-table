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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-23)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
