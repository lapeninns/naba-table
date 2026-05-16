# [MEDIUM] Layout populates a stale membership cache reused by authorization checks

**File:** [`src/app/app/(app)/layout.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/layout.tsx#L90>) (lines 90)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-stale-authorization-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The layout calls fetchUserMembershipsCached(supabaseUser.id) and populates the process-wide membership cache in server/team/access.ts. That same cache is consulted by requireMembershipForRestaurant/requireAdminMembership before querying Supabase, and grep found no call sites for invalidateUserMembershipsCache. A user who loads the ops app while they are an owner/manager can keep a cached restaurant role for up to 30 seconds after being removed or demoted, allowing subsequent ops API calls on the same instance to pass stale membership/admin checks. This is a TOCTOU authorization issue; it requires prior legitimate access but bypasses revocation during the cache TTL.

## Recommendation

Do not share the layout's UI membership cache with authorization decisions. Make requireMembershipForRestaurant and requireAdminMembership query the database for every sensitive check, or use only request-scoped/versioned cache with reliable cross-process invalidation on membership and role changes.

## Revalidation

**Verdict:** fixed

The ops layout may populate `fetchUserMembershipsCached`, but `requireMembershipForRestaurant` defaults `useCache` to `false`, and `requireAdminMembership` delegates to that uncached path. Covered by `tests/server/team-access-cache.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
