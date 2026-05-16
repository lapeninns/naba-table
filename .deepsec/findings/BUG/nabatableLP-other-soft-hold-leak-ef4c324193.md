# [BUG] Direct assignment pre-check leaks soft holds until TTL

**File:** [`src/app/api/ops/bookings/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/tables/route.ts#L79-L106) (lines 79, 84, 106)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-soft-hold-leak`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

evaluateManualSelection acquires soft holds by default and returns a softHoldSessionToken when validation succeeds. This route uses it only as a pre-check, ignores the returned token, and proceeds to assign the table. Successful validations therefore leave the soft hold behind until its TTL expires, temporarily blocking other operators from selecting the same table; repeated requests can keep tables unnecessarily locked.

## Recommendation

Call evaluateManualSelection with skipSoftHolds for this pre-check, or release validation.softHoldSessionToken in a finally block after the assignment path completes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
