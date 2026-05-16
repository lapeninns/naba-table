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

## Revalidation

**Verdict:** fixed

`updateRestaurantBusinessContext` no longer performs per-family delete/insert chains in application code. It builds the requested replacement rows first, validates persisted UUIDs, duplicate row ids, service-area types, attribute value types, and primary category uniqueness before mutation, then calls the service-role-only `replace_restaurant_business_context_core` RPC once for all requested families. The migration materializes incoming rows, checks duplicate ids, takes a per-restaurant advisory transaction lock, and performs delete/insert replacement inside the same database function, so a failed insert rolls back instead of erasing existing business-context rows. Focused evidence: `pnpm exec vitest run tests/server/restaurants/atomic-replacements.test.ts tests/server/restaurant-business-context.test.ts tests/server/restaurant-business-context-routes.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
