# [HIGH] Occasion catalog mutations lack backend role authorization

**File:** [`src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityOccasionsEditor.tsx#L153-L206) (lines 153, 171, 206)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The editor exposes create, update, and delete paths for booking occasions at lines 153, 171, and 206. Tracing the save path shows these call /api/ops/occasions and /api/ops/occasions/[key], whose handlers only require a Supabase user and then use the service-role client to mutate the global booking_occasions catalog. They do not call requireAdminMembership or any equivalent role-aware backend authorization. Because these occasions are global catalog data used by the booking flow, a low-privileged authenticated ops user with any membership can rename, disable, or delete occasion options affecting other restaurants.

## Recommendation

Enforce authorization in the route handlers before any service-role write. Either restrict global occasion management to a true platform/admin permission, or scope occasions by restaurant_id and require requireAdminMembership/requireMembershipForRestaurant for that restaurant. Do not rely on Next.js proxy middleware as the only guard.

## Revalidation

**Verdict:** fixed

I read the full component and confirmed it only stages occasion edits locally through onChange; the actual save path is in AvailabilityScheduleManager. That path still calls occasionService.createOccasion, updateOccasion, and deleteOccasion, which map to /api/ops/occasions and /api/ops/occasions/[key]. In current code, POST, PATCH, and DELETE on those routes call withPlatformAdminAuthorization(request, { csrf: true }) before any service-role write. withPlatformAdminAuthorization first applies the ops mutation/session and CSRF guard, then requires the user id or email to be listed in PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS. The booking_occasions table is still global and service-role-backed, but low-privileged restaurant members can no longer reach the writes. Git blame shows this platform-admin guard was added in commit 020a7389 Apply security sprint fixes and staging migrations, so the described missing backend authorization has been patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
