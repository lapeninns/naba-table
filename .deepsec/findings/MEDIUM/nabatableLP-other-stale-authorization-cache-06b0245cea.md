# [MEDIUM] Process-wide membership cache allows stale authorization after demotion or removal

**File:** [`server/team/access.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/access.ts#L14-L257) (lines 14, 22, 172, 178, 179, 190, 193, 203, 257)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-stale-authorization-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

fetchUserMembershipsCached stores memberships in a process-wide Map for 30 seconds, and requireMembershipForRestaurant checks that cache before querying Supabase. requireAdminMembership delegates to the same cached path. The exported invalidation helper has no production callers, so a user who loads the ops app while they are an owner/manager can continue passing membership or admin checks on the same warm server process for up to the cache TTL after being removed or demoted.

## Recommendation

Do not use the display/layout membership cache for authorization decisions. Always query the source of truth for requireMembershipForRestaurant/requireAdminMembership, or add reliable invalidation on every membership mutation with a distributed version/revocation mechanism that works across server instances.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
