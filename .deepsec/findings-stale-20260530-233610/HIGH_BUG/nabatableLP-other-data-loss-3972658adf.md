# [HIGH_BUG] Railway table replacement can silently unassign active or future bookings

**File:** [`scripts/update-railway-zones-tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/update-railway-zones-tables.ts#L260-L273) (lines 260, 266, 267, 268, 273)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

clearExisting() collects every table_inventory id for the target restaurant, deletes all booking_table_assignments for those table ids, removes related holds/windows, and then deletes/recreates the table inventory. There is no preflight that rejects active or future bookings before deleting their assignments. The normal ops table delete path uses the guarded delete_table_inventory_guarded RPC to reject active/future assignments, but this production maintenance script bypasses that invariant and can commit with upcoming confirmed bookings left without assigned tables.

## Recommendation

Before any delete, query bookings joined to booking_table_assignments for active or future non-cancelled bookings and abort with a report, or explicitly remap those assignments inside the same transaction. Keep the guarded deletion invariant in the script instead of directly deleting assignments.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
