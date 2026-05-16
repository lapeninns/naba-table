# [HIGH_BUG] Business-context saves can delete existing rows before a failing insert

**File:** [`src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/RestaurantBusinessContextSection.tsx#L716-L764) (lines 716, 720, 729, 741, 756, 764)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The component sends whole-family replacement payloads for service areas, attributes, service items, and categories. Tracing updateRestaurantBusinessContext shows replaceCoreRows first deletes all existing core rows for the restaurant and family, then performs a separate insert with no transaction. Several fields are free-form in this UI and can violate DB constraints that the API schema does not fully enforce, such as serviceAreas.areaType needing one of place/region/postal_code/other and attributes.valueType needing one of boolean/text/uri/enum/multienum. If the insert fails after the delete, the restaurant's saved discovery metadata for that family is lost.

## Recommendation

Make each family replacement atomic, preferably through a database RPC/transaction that validates and replaces rows together. Mirror DB constraints in the route schema before deletion, and avoid delete-then-insert outside a transaction.

## Revalidation

**Verdict:** fixed

The UI still sends whole-family business-context payloads, but the server path behind those saves no longer deletes existing rows before a separate insert. The PUT route rejects malformed persisted ids and invalid DB enum values before calling the writer, while `updateRestaurantBusinessContext` validates the replacement rows and commits requested families through the service-role-only `replace_restaurant_business_context_core` RPC. Focused tests prove route rejection, direct writer rejection, RPC delegation, and absence of direct family-table inserts from the writer: `pnpm exec vitest run tests/server/restaurants/atomic-replacements.test.ts tests/server/restaurant-business-context.test.ts tests/server/restaurant-business-context-routes.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
