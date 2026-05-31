# [HIGH_BUG] Operating-hours replacement can erase the schedule on insert failure

**File:** [`src/app/api/ops/restaurants/[id]/hours/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/hours/route.ts#L83-L217) (lines 83, 84, 85, 217)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PUT passes the parsed payload to updateOperatingHours. The helper deletes all restaurant_operating_hours rows for the restaurant and then performs a separate insert outside a transaction. If the insert fails after the delete, for example from duplicate override IDs or another database error, the restaurant is left with its operating-hours schedule removed. The route schema does not validate duplicate override IDs or dates before calling the destructive replacement.

## Recommendation

Replace hours atomically in a database transaction or SECURITY DEFINER RPC, and validate duplicate override IDs/effectiveDate values before deleting existing rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
