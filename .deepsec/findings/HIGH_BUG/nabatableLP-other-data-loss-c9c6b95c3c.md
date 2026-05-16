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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
