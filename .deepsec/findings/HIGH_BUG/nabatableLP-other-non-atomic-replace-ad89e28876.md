# [HIGH_BUG] Failed business-context writes can delete existing profile data

**File:** [`src/app/api/ops/restaurants/[id]/business-context/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/business-context/route.ts#L186-L207) (lines 186, 195, 207)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PUT route validates the request shape and then calls updateRestaurantBusinessContext, whose replacement helpers delete existing core rows before inserting the replacement rows, without a transaction. Several fields that reach DB constraints are not fully validated here, such as arbitrary non-UUID id values, serviceAreas.areaType, attributes.valueType, duplicate primary rows, and unbounded text/JSON. A payload that passes Zod but fails the insert can leave that business-context family deleted even though the API returns an error.

## Recommendation

Make each family replacement atomic, preferably via a Supabase RPC transaction that validates and replaces rows together. Also mirror DB constraints in the route schema, including UUID ids, enum values, max lengths, and primary-row uniqueness, before any delete runs.

## Revalidation

**Verdict:** fixed

The PUT route and shared writer now fail before mutation for malformed persisted ids and DB enum values, and the writer performs replacement through the atomic `replace_restaurant_business_context_core` RPC rather than deleting rows from application code. The writer also validates duplicate row ids and primary-category uniqueness before invoking the RPC. Focused route/service evidence covers invalid ids, invalid service-area and attribute enums, RPC delegation, and absence of direct family table inserts from `updateRestaurantBusinessContext`: `pnpm exec vitest run tests/server/restaurants/atomic-replacements.test.ts tests/server/restaurant-business-context.test.ts tests/server/restaurant-business-context-routes.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
