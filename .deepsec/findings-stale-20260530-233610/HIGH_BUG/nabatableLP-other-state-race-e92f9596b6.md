# [HIGH_BUG] Unassignment can return success and race booking status back to pending

**File:** [`src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/tables/[tableId]/route.ts#L82-L113) (lines 82, 91, 99, 106, 107, 113)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-state-race`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route awaits unassignTableFromBooking but never checks its boolean result; the helper returns false on RPC error, so this handler can continue and return HTTP 200 after a failed unassign. It then separately reads assignments, reads booking status, and updates confirmed bookings to pending when no assignments are observed. A concurrent reassignment between those steps can leave a booking with assigned tables but status pending.

## Recommendation

Move unassign, remaining-assignment check, and conditional status transition into one database transaction/RPC that reports affected rows and fails on errors. At minimum, check the helper result and condition the status update on no assignments at update time.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
