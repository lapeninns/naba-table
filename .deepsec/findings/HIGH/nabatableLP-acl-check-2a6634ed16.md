# [HIGH] Any authenticated user can create zones for arbitrary restaurants

**File:** [`src/app/api/onboarding/restaurant/[id]/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/zones/route.ts#L27-L59) (lines 27, 28, 38, 55, 58, 59)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler authenticates only the user session, then takes `restaurantId` directly from the route params and calls `createZone()` with a service-role Supabase client. No backend authorization verifies that the user owns or belongs to that restaurant. An authenticated attacker can create zones under another tenant and alter their table organization/capacity model.

## Recommendation

Require `requireMembershipForRestaurant` or `requireAdminMembership` for the route `restaurantId` before creating zones. Avoid service-role writes unless the tenant authorization check has already succeeded.

## Revalidation

**Verdict:** fixed

The current code no longer lets a merely authenticated user pass an arbitrary route id directly into createZone. Before payload parsing or service-role construction, the handler calls withRestaurantAuthorization for the URL restaurantId with owner/manager roles. The guard's requireMembershipForRestaurant lookup is scoped by both user_id and restaurant_id, and membership absence or role mismatch returns 403. Only an authorized restaurant admin can reach getServiceSupabaseClient and createZone. The service-role write remains intentionally used after authorization, so the relevant mitigation is the new route-level tenant check rather than RLS. Commit 020a7389 shows the vulnerable session-only pattern was replaced by this guard. The focused Vitest run passed, including the onboarding authorization failure containment tests.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
