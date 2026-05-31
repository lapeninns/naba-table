# [BUG] Provider row replacement can leave partial Google profile state

**File:** [`server/google-business-profile/business-info.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/business-info.ts#L1719-L2054) (lines 1719, 1724, 1737, 2017, 2030, 2043, 2054)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-non-atomic-sync`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

syncGoogleBusinessProfileCanonicalBusinessInfo replaces each provider table by deleting existing GBP-managed rows and then inserting the freshly built rows, without a transaction across the delete/insert pair or across the full multi-table sync. If an insert or later table replacement fails after a delete succeeds, previously synced Google profile rows are lost or the provider mirror is left partially refreshed even though the outer sync reports failure.

## Recommendation

Move the canonical GBP sync into a transactional database RPC, or stage new rows and swap them atomically. At minimum, avoid deleting existing rows until replacement rows have been validated and make the multi-table snapshot/update/change-log sequence rollback together.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
