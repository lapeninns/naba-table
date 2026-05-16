# [MEDIUM] Service-role export authorization can use stale cached memberships

**File:** [`src/app/api/ops/bookings/export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/export/route.ts#L75-L83) (lines 75, 82, 83)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-stale-authorization-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route authorizes the requested restaurant via requireMembershipForRestaurant and then reads booking PII with getServiceSupabaseClient. requireMembershipForRestaurant first trusts the process-local userMembershipsCache populated by fetchUserMembershipsCached in the app layout, with a 30 second TTL and no invalidation call sites found. A user whose membership was just revoked or demoted can still export bookings for the cached restaurant during that window if their layout request populated the cache before revocation.

## Recommendation

Do not use the layout membership cache for API authorization, especially before service-role reads. Make requireMembershipForRestaurant perform a fresh lookup by default for route handlers, or add a cache: false option and use it here; also invalidate membership cache on any membership write.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
