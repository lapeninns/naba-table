# [MEDIUM] Google Business Profile admin actions can be authorized from stale cached roles

**File:** [`src/app/api/ops/restaurants/[id]/google-business/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/route.ts#L17-L41) (lines 17, 35, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-stale-authorization-cache`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Both GET and DELETE call requireGoogleBusinessAdminAccess, which delegates to ensureRestaurantAdminAccess and requireAdminMembership. The underlying membership helper trusts a process-local cached membership before querying the database. A user recently demoted or removed from owner/manager can still load Google Business Profile status and disconnect the integration during the 30 second cache TTL if their membership was cached by the app layout.

## Recommendation

Use a fresh, uncached admin membership check for this API route before reading Google Business Profile state or disconnecting credentials. Keep the existing membership cache limited to layout/session display data and invalidate it on membership changes.

## Revalidation

**Verdict:** fixed

Google Business Profile admin guards delegate to `requireAdminMembership`, which delegates to `requireMembershipForRestaurant` with the default uncached authorization path. Covered by `tests/server/team-access-cache.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)
