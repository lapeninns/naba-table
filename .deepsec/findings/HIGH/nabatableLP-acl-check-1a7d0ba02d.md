# [HIGH] Global booking occasions can be changed without role authorization

**File:** [`src/components/features/restaurant-settings/OccasionsSection.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/OccasionsSection.tsx#L70-L131) (lines 70, 73, 96, 116, 131)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This component performs create, update, delete, and toggle mutations through the occasion service, but that service maps to /api/ops/occasions and /api/ops/occasions/[key]. Tracing the handlers showed they only call supabase.auth.getUser() before using getServiceSupabaseClient() to write booking_occasions; they do not require restaurant admin membership, platform-admin authorization, or a restaurant-scoped ownership check. booking_occasions is a global table with no restaurant_id, so any authenticated user who can reach the ops API path can create, disable, edit, or soft-delete bookable occasions affecting all tenants. Next proxy requireOpsAuth is not a sufficient backend authorization control here, and it only proves some membership, not permission to mutate global settings.

## Recommendation

Move authorization into the /api/ops/occasions handlers. Require a platform-level admin role for global occasion catalog changes, or redesign occasions to be restaurant-scoped and require requireAdminMembership for the target restaurant before any service-role write. Also validate CSRF for these session-cookie mutations.

## Revalidation

**Verdict:** fixed

OccasionsSection still performs create, update, delete, and toggle mutations through useOccasionService, so I traced that service to the current ops occasion API routes. The service has no client-side role enforcement, but that is not relied on for security. The current POST route calls withPlatformAdminAuthorization(request, { csrf: true }) before using getServiceSupabaseClient to upsert booking_occasions. The current PATCH and DELETE route for [key] uses the same platform-admin guard before any service-role update or soft-delete. withPlatformAdminAuthorization uses withOpsMutation plus explicit PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS checks, so a normal ops member cannot satisfy it. The missing backend role authorization described in the finding is therefore fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
