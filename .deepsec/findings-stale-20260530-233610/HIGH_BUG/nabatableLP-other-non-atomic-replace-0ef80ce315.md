# [HIGH_BUG] Business-context replacement deletes existing rows before replacement rows are known to be insertable

**File:** [`server/restaurants/businessContext.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/businessContext.ts#L478-L724) (lines 478, 495, 506, 522, 680, 724)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The family replacement helpers delete all existing Nabatable-managed rows for a restaurant and only then insert the replacement rows. If the insert fails, the previous links/categories/service areas/attributes/service items are already gone. This is reachable with malformed but route-accepted input, for example a non-UUID row id or duplicate rows that violate primary/unique constraints; the ops route only requires non-empty string ids while these tables use UUID primary keys. Multi-family updates can also partially apply earlier families before a later family fails.

## Recommendation

Move each replace operation into a database transaction/RPC that validates and inserts the replacement set before deleting or commits delete+insert atomically. Also validate supplied ids as UUIDs and enforce uniqueness constraints in the API schema before calling this helper.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
