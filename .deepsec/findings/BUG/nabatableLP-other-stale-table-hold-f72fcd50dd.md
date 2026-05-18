# [BUG] Smart assign can leave table holds unconfirmed or unreleased

**File:** [`src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/dashboard/booking-details/components/TableAssignmentPanel.tsx#L201-L332) (lines 201, 208, 332)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-stale-table-hold`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

handleSmartAssign delegates to useTableAssignment.autoAssign. The traced hook first calls bookingService.autoQuoteTables, whose /api/staff/auto/quote flow creates a table_holds row, then the hook directly calls assignTablesDirect with the quoted table IDs instead of confirming or releasing the hold. assignTablesDirect creates booking_table_assignments but does not consume the quote hold, and unassignTablesDirect does not clear it later. If direct assignment fails, or if the user resets the assignment after a smart assign, stale active holds can continue blocking planner availability until the hold expires.

## Recommendation

Use the quote/confirm flow with the returned holdId, or make smart assign use a dry-run quote that does not create holds. If direct assignment remains, release the created hold in a finally path on both success and failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-06)
