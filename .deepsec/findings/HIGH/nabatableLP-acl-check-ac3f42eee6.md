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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
