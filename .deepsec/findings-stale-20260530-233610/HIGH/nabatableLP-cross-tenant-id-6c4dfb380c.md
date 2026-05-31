# [HIGH] Any authenticated user can overwrite another restaurant's onboarding hours

**File:** [`src/app/api/onboarding/restaurant/[id]/hours/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/hours/route.ts#L41-L75) (lines 41, 42, 52, 69, 70, 75)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The PATCH handler validates CSRF and checks only that a Supabase user exists. It never verifies that user.id owns or belongs to the restaurantId from the URL, then calls updateOperatingHours with getServiceSupabaseClient. updateOperatingHours performs a full replacement of restaurant_operating_hours for that restaurant_id, and the service-role client bypasses RLS. Any authenticated user who knows another restaurant UUID can replace or wipe that tenant's operating hours.

## Recommendation

Before using the URL restaurantId, require owner/admin membership for that restaurant with requireAdminMembership or an onboarding-specific ownership check. Prefer a tenant-scoped/RLS-aligned client where possible, and only call the destructive replacement helper after authorization succeeds.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
