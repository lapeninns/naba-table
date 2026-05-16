# [HIGH] Occasion admin helpers are used without backend admin authorization

**File:** [`server/occasions/admin.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/occasions/admin.ts#L53-L96) (lines 53, 69, 81, 96)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

These admin helpers default to getServiceSupabaseClient(), bypassing RLS for booking_occasions and booking_occasions_audit. The ops occasion route handlers that call them only resolve supabase.auth.getUser() before listing, creating, updating, or deleting occasions; they do not call requireAdminMembership or any platform-admin guard. The proxy-level requireOpsAuth only proves the user has some restaurant membership, not an admin role, and is not sufficient backend authorization. A non-admin staff user reaching these handlers can alter the global occasion catalog used across restaurants.

## Recommendation

Require an explicit backend admin/platform-admin authorization check before every caller can use these service-role helpers. Avoid defaulting admin data helpers to the service client unless the function also receives and verifies an authorized actor context.

## Revalidation

**Verdict:** fixed

The helper functions in server/occasions/admin.ts still default to getServiceSupabaseClient(), so they remain privileged helpers. However, the current mutable route callers no longer match the finding: POST /api/ops/occasions calls withPlatformAdminAuthorization(request, { csrf: true }) before parsing the body or constructing the service client, and PATCH/DELETE /api/ops/occasions/[key] do the same. withPlatformAdminAuthorization goes through withOpsMutation, validates CSRF for unsafe methods, resolves the session, and then requires the user id or email to be listed in PLATFORM_ADMIN_USER_IDS or PLATFORM_ADMIN_EMAILS. A non-admin ops member now receives a 403 before any booking_occasions write or audit insert. GET /api/ops/occasions still only requires an authenticated user and uses fetchAllOccasions(), but that read path does not support the described global-catalog alteration attack. Commit 020a7389 added the platform-admin guard to the mutable occasion handlers, so the reported high-impact mutation path is patched.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
