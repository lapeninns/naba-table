# [HIGH] Occasion creation lacks backend admin authorization

**File:** [`src/app/api/ops/occasions/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/occasions/route.ts#L33-L133) (lines 33, 34, 46, 78, 116, 128, 133)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler only verifies that a Supabase user exists. It never calls requireMembershipForRestaurant(), requireAdminMembership(), or a platform-admin guard before using the service-role client to query/upsert booking_occasions and write audit rows. In this codebase, the proxy-level requireOpsAuth guard is not a sufficient mitigation and only proves some restaurant membership. Any authenticated ops member, including lower-privilege host/server users, can create or reactivate global booking occasion definitions. Because booking_occasions is not restaurant-scoped, this can affect availability/occasion behavior across tenants.

## Recommendation

Add a backend authorization check before any service-role access. For global occasion definitions, require a dedicated platform-admin permission; if occasions are intended to be restaurant-scoped, add restaurant_id to the route/data model and requireAdminMembership() for that restaurant before mutation.

## Revalidation

**Verdict:** fixed

The current POST handler starts with withPlatformAdminAuthorization(request, { csrf: true }) before it parses the body or creates a service-role client. That guard calls withOpsMutation, which validates CSRF for the unsafe POST and resolves the Supabase session. It then requires the user id or email to appear in PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS. A normal ops member or host/server role now receives a 403 PLATFORM_ADMIN_REQUIRED response before any booking_occasions query or upsert. The service-role client is only created after this route-local platform-admin decision. This directly fixes the missing backend authorization described in the finding.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)
