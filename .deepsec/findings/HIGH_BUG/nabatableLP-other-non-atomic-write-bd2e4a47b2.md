# [HIGH_BUG] Business-context replacement deletes existing rows before successful insert

**File:** [`server/restaurants/businessContext.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/businessContext.ts#L478-L896) (lines 478, 495, 506, 522, 739, 785, 851, 896)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-write`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

replaceCoreRows() and replaceCoreLinks() delete the current Nabatable-managed rows for a restaurant before inserting the replacement rows. If the insert fails because of a database error, duplicate primary IDs, invalid UUIDs, multiple primary categories/links, or a transient network failure, the old rows are already gone. updateRestaurantBusinessContext() also performs each family replacement independently, so a later family or change-log failure can leave a partially applied profile update. The ops route has an admin membership guard, so this is not a cross-tenant auth issue, but it is a real data-loss/corruption risk.

## Recommendation

Move each replacement into a single database transaction or Postgres RPC that validates the full payload, inserts/upserts replacements, deletes obsolete rows, and writes the change log atomically. Also validate server-side uniqueness constraints such as one primary category/link before deleting existing data.

## Revalidation

**Verdict:** fixed

The data-loss path from `replaceCoreRows()` and `replaceCoreLinks()` is removed. `updateRestaurantBusinessContext` now prepares and validates all requested rows, then delegates the core-family replacement to `replace_restaurant_business_context_core` in one RPC call; the service helper body no longer contains `.delete()` or family-table `.insert()` replacement calls. The RPC migration takes a per-restaurant transaction lock, validates incoming recordsets, checks duplicate ids, and performs each delete/insert block inside the same database function so failed replacement rows roll back without deleting the previous core rows. Focused evidence: `pnpm exec vitest run tests/server/restaurants/atomic-replacements.test.ts tests/server/restaurant-business-context.test.ts tests/server/restaurant-business-context-routes.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
