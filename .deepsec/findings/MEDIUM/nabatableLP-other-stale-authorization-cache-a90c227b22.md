# [MEDIUM] Admin-only drink item reads and updates can be authorized from stale cached roles

**File:** [`src/app/api/ops/restaurants/[id]/drinks/items/[itemId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/drinks/items/[itemId]/route.ts#L33-L98) (lines 33, 57, 98)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-stale-authorization-cache`

## Finding

GET and PUT rely on ensureRestaurantAdminAccess before reading or mutating drink menu data. That helper ultimately calls requireAdminMembership, whose underlying requireMembershipForRestaurant trusts the process-local userMembershipsCache before querying the database. Because the cache is populated by the app layout for 30 seconds and no invalidation call sites were found, a recently demoted or removed owner/manager can continue to read or update drink items during the cache window.

## Recommendation

Ensure API permission checks perform a fresh membership lookup and do not consume the layout cache. Add an explicit uncached authorization path for route handlers or make cached membership reads display-only.
