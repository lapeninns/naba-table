# [HIGH_BUG] Business-context imports can wipe or lose section rows on failed or concurrent writes

**File:** [`server/dual-sync/publish/ports/business-context-import.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/ports/business-context-import.ts#L138-L391) (lines 138, 213, 316, 391)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Each per-field import reads the current business-context section, splices one Google value, then writes the whole subsection back through updateRestaurantBusinessContext. The traced writer deletes all Core rows for the subsection before inserting the rebuilt array, without a transaction or per-restaurant/section lock. If the insert fails after the delete, or two publish jobs interleave, a one-field import can leave categories/service areas/attributes/service items empty or overwrite a concurrent import.

## Recommendation

Make the replacement atomic with a database transaction/RPC or advisory lock, or change imports to upsert/delete only the targeted row with conditional drift checks. Avoid delete-then-insert outside a transaction.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
