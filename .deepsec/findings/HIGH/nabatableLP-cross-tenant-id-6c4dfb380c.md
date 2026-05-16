# [HIGH] Any authenticated user can overwrite another restaurant's onboarding hours

**File:** [`src/app/api/onboarding/restaurant/[id]/hours/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/hours/route.ts#L41-L75) (lines 41, 42, 52, 69, 70, 75)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PATCH handler validates CSRF and checks only that a Supabase user exists. It never verifies that user.id owns or belongs to the restaurantId from the URL, then calls updateOperatingHours with getServiceSupabaseClient. updateOperatingHours performs a full replacement of restaurant_operating_hours for that restaurant_id, and the service-role client bypasses RLS. Any authenticated user who knows another restaurant UUID can replace or wipe that tenant's operating hours.

## Recommendation

Before using the URL restaurantId, require owner/admin membership for that restaurant with requireAdminMembership or an onboarding-specific ownership check. Prefer a tenant-scoped/RLS-aligned client where possible, and only call the destructive replacement helper after authorization succeeds.

## Revalidation

**Verdict:** fixed

The previously described attack required a logged-in user to supply another restaurant UUID and reach updateOperatingHours through the service-role client. In the current code, the supplied id is validated and authorized by withRestaurantAuthorization before the request body is parsed. That guard requires a live Supabase session and an owner or manager restaurant_memberships row for the same restaurantId from the URL. A user who is authenticated but not a member of the target restaurant receives a 403 from the guard path and the destructive delete/insert helper is not called. The route still performs a full replacement of restaurant_operating_hours, but it is now behind the per-restaurant admin authorization check. Commit 020a7389 shows the vulnerable pattern was removed and replaced by this guard. The targeted Vitest run passed the route-containment regression for onboarding authorization failures.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
