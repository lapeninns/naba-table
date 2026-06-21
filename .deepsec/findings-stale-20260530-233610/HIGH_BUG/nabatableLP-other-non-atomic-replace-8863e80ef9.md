# [HIGH_BUG] Malformed row IDs can erase existing business-context rows

**File:** [`src/app/api/ops/restaurants/[id]/business-context/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/business-context/route.ts#L62-L195) (lines 62, 74, 85, 98, 124, 195)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PUT accepts arbitrary non-empty string IDs for links, categories, service areas, attributes, and service items, then passes the payload to updateRestaurantBusinessContext. The imported service performs destructive replace operations by deleting existing core rows before inserting the supplied rows, without a transaction. A request with a syntactically valid payload but an invalid database ID, duplicate ID, or other insert-time failure can leave the restaurant's existing rows deleted even though the API returns an error. This can cause data loss or partial saves across business-context families.

## Recommendation

Validate supplied persisted IDs as UUIDs, ignore client-generated IDs for new rows, and make each family replacement atomic through a database transaction/RPC or an insert-then-swap strategy that cannot commit the delete unless the replacement insert succeeds.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
