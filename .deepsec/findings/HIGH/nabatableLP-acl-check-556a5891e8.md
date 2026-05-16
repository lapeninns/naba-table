# [HIGH] Availability settings can drive a globally scoped occasions write path without tenant/admin authorization

**File:** [`src/app/app/(app)/settings/restaurant/availability/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/availability/page.tsx#L12>) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The page renders the availability settings client at line 12. Following that import reaches AvailabilityScheduleManager and AvailabilityOccasionsEditor, which create, update, and delete booking occasions through /api/ops/occasions. Those route handlers only check supabase.auth.getUser(), then use getServiceSupabaseClient() to mutate booking_occasions, which is a global table with no restaurant_id. They do not call requireAdminMembership or otherwise bind the write to the active restaurant. A user with access to one tenant can directly call those endpoints to alter the global occasion catalog used by other restaurants, and the route handler itself does not provide a backend membership/admin guard independent of proxy middleware.

## Recommendation

Make occasions restaurant-scoped and expose them under a restaurant-bound API that calls requireAdminMembership for that restaurant before using a service-role client. If occasions are intentionally platform-global, restrict these handlers to a platform-admin role and do not expose mutation controls through restaurant settings. Add negative authorization tests for host/server/non-member users.

## Revalidation

**Verdict:** fixed

The UI still reaches `AvailabilityScheduleManager` and can call `occasionService.createOccasion`, `updateOccasion`, and `deleteOccasion`, but the backend path has changed. The current POST/PATCH/DELETE handlers for `/api/ops/occasions` all run `withPlatformAdminAuthorization(..., { csrf: true })` before service-role writes. `withPlatformAdminAuthorization` is not just a session check: it wraps `withOpsMutation`, verifies CSRF for unsafe methods, then checks configured platform-admin ids/emails. A normal owner, manager, host, or server who is not a platform admin receives `PLATFORM_ADMIN_REQUIRED` before any catalog mutation. Because the global table is now protected by a platform-admin guard, the described cross-tenant integrity attack is patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
