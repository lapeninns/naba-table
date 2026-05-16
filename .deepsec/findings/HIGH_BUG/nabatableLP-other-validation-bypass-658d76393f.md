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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
