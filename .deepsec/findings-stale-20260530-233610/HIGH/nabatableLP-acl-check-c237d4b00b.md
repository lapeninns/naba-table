# [HIGH] Global booking occasions can be mutated without role authorization

**File:** [`src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/AvailabilityScheduleManager.tsx#L86-L521) (lines 86, 210, 483, 507, 521)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

AvailabilityScheduleManager lets the settings UI create, update, and delete booking occasions via occasionService. Tracing those calls reaches /api/ops/occasions and /api/ops/occasions/[key], whose handlers only check supabase.auth.getUser() and then use getServiceSupabaseClient() to insert/update/delete rows in the global booking_occasions table. They do not require restaurant admin membership, a platform-admin role, or any resource-level authorization. A lower-privileged ops user, or any authenticated user if the middleware guard is missed, can create active occasions or modify built-in lunch/dinner metadata and availability, affecting booking/service-period behavior across tenants.

## Recommendation

Move occasion mutations behind a backend authorization check appropriate for global catalog changes, such as a platform-admin guard. If occasions are intended to be restaurant-specific, include restaurantId in the API contract and enforce requireAdminMembership for that restaurant before using the service-role client. Also restrict built-in occasion updates explicitly.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
