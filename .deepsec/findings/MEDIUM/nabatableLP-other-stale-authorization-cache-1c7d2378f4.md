# [MEDIUM] Ops layout seeds a membership cache reused by authorization guards

**File:** [`src/app/app/(app)/layout.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/layout.tsx#L16-L90>) (lines 16, 90)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-stale-authorization-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The layout calls fetchUserMembershipsCached(supabaseUser.id), which stores the user's restaurant memberships in the process-wide cache in server/team/access.ts. That same cache is consulted by requireMembershipForRestaurant and requireAdminMembership before querying Supabase, including for admin-sensitive ops API routes. A grep of production source found invalidateUserMembershipsCache has no callers, so a user who loads the ops app while still an owner/manager can continue passing membership/admin checks on the same warm server process for up to the 30 second cache TTL after being removed or demoted. This is a TOCTOU authorization issue; it requires prior legitimate access, but it bypasses revocation during the cache window.

## Recommendation

Do not share the server-render display cache with authorization decisions. Make requireMembershipForRestaurant/requireAdminMembership perform a fresh membership lookup, or use a separate non-authoritative layout cache and explicitly invalidate authorization cache entries from every membership mutation/revocation path.

## Revalidation

**Verdict:** fixed

The ops layout may populate `fetchUserMembershipsCached`, but `requireMembershipForRestaurant` defaults `useCache` to `false`, and `requireAdminMembership` delegates to that uncached path. Covered by `tests/server/team-access-cache.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
