# [HIGH_BUG] Manual assignment validation result is ignored

**File:** [`src/app/api/ops/bookings/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/tables/route.ts#L79-L106) (lines 79, 86, 88, 106)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-validation-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route calls evaluateManualSelection, but only rejects the specific holds check. If validation returns ok=false for other blocking checks such as disabled/out-of-service tables, insufficient capacity, excessive slack, or conflicts, the handler still calls assignTableToBooking with the service-role client. Lower-level RPCs may catch some conflicts, but this API bypasses the shared manual validation decision it just computed.

## Recommendation

Reject when validation.ok is false or when any validation check has status error, returning structured validation details. Add route tests for inactive tables, insufficient capacity, over-slack assignments, and conflicts.

## Revalidation

**Verdict:** fixed

`src/app/api/ops/bookings/[id]/tables/route.ts` now rejects failed manual validation before calling `assignTableToBooking`. It checks both `validation.ok` and any checks with `status === "error"` and returns a structured 422 response instead of continuing to service-role assignment. Focused evidence: `tests/server/ops-booking-table-assignment-route.test.ts` verifies a failed capacity validation prevents `assignTableToBooking`; the focused table/assignment Vitest set, targeted ESLint, targeted Prettier check, and `pnpm run typecheck` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
