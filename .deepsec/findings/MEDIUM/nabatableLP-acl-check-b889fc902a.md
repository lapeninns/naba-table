# [MEDIUM] Authorization guard can use stale cached membership roles

**File:** [`server/team/access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/access.ts#L14-L193) (lines 14, 22, 172, 189, 193)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

fetchUserMembershipsCached stores memberships for 30 seconds by userId, and requireMembershipForRestaurant checks that cache before querying the database, including when requireAdminMembership asks for owner/manager roles. invalidateUserMembershipsCache has no callers. If a user loads the ops app and is then removed or demoted, the same warm server process can continue authorizing admin-protected actions from the cached role until the TTL expires.

## Recommendation

Keep the cached membership list for UI rendering only, or make requireMembershipForRestaurant always perform a fresh authorization query for API and mutation guards. If caching remains, invalidate it on every membership create/update/delete and avoid using cached elevated roles for admin checks.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

**Verdict:** fixed

`requireMembershipForRestaurant` now defaults `useCache` to `false`, so API and mutation authorization guards perform a fresh membership query unless a caller explicitly opts into cache use. The cache remains available for server-rendered layout membership reads only.

Validation: `pnpm exec vitest run tests/server/restaurant-google-business-v1-routes.test.ts tests/cloudflare/booking-short-links-storage.test.ts tests/server/team-access-cache.test.ts tests/server/ops-restaurants-route-security.test.ts tests/server/tenant-authorization-sprint2.test.ts`
