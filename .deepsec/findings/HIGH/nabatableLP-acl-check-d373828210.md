# [HIGH] Any authenticated user can mutate the global occasion catalog

**File:** [`src/app/api/ops/occasions/[key]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/occasions/[key]/route.ts#L20-L135) (lines 20, 33, 66, 106, 110, 135)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH and DELETE only require supabase.auth.getUser() to return a user. They do not require restaurant membership, admin role, or a platform-admin permission before switching to getServiceSupabaseClient and updating booking_occasions. Because booking occasions are a global catalog used by staff and guest booking flows, any authenticated account that can reach this handler can rename, disable, reorder, change availability for, or soft-delete non-builtin occasions across all tenants.

## Recommendation

Require an explicit privileged authorization check before service-role mutations, such as a platform-admin guard or at least requireAdminMembership for the relevant restaurant-scoped settings flow. Avoid using the service-role client until that authorization has succeeded.

## Revalidation

**Verdict:** fixed

The current PATCH and DELETE handlers no longer rely only on supabase.auth.getUser(). Both call withPlatformAdminAuthorization(request, { csrf: true }) before parsing mutations or creating the service-role client. That guard calls withOpsMutation, enforces CSRF for unsafe methods, resolves a live Supabase session, and then requires the user id or email to appear in PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS. The service-role client is only created after that privileged authorization succeeds. The proxy also guards /api/ops/\* with requireOpsAuth, but the decisive route-level fix is the platform-admin check. A normal authenticated restaurant member can still reach the ops surface, but without the platform-admin env allowlist they receive PLATFORM_ADMIN_REQUIRED/403 and cannot update or soft-delete booking_occasions. Git commit 020a7389 replaced the prior plain session check with withPlatformAdminAuthorization and moved audit user attribution to authorization.user.id, so the reported bug was patched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
