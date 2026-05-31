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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
