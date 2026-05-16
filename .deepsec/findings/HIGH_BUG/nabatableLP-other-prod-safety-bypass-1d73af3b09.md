# [HIGH_BUG] Staging bootstrap can modify production auth and grant all-restaurant access

**File:** [`scripts/staging/bootstrap-owner.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/staging/bootstrap-owner.ts#L70-L197) (lines 70, 72, 93, 100, 133, 181, 197)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-prod-safety-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The script loads .env.local and creates a service-role Supabase client from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY without validating APP_ENV, the Supabase project ref, or whether the target is production. It then creates or updates the auth user password and upserts memberships for every restaurant. If an operator or automation runs this with production env values, it can create or take over a production user and grant access across all tenants.

## Recommendation

Hard-fail unless the resolved Supabase URL matches an explicit approved staging project ref and the validated env says staging. Reuse the central env safety checks and require an explicit project-ref confirmation before any service-role auth or membership mutation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
