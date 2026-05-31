# [HIGH_BUG] Non-atomic unassignment can corrupt booking status

**File:** [`server/capacity/table-assignment/direct-assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/capacity/table-assignment/direct-assignment.ts#L670-L700) (lines 670, 686, 700)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

unassignTablesDirect deletes assignment rows, then separately reads remaining assignments, then separately updates the booking status to pending. There is no transaction, booking-row lock, or atomic RPC around those three operations. A concurrent reassignment can insert a new assignment after the empty check but before the status update, leaving a booking with active table assignments but status pending. The repo already has an unassign_tables_atomic RPC elsewhere, but this helper bypasses it.

## Recommendation

Replace this read-delete-update sequence with the existing unassign_tables_atomic RPC, or move the delete, remaining-assignment check, and status transition into one database transaction that locks the booking row and updates status only with a NOT EXISTS predicate.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
