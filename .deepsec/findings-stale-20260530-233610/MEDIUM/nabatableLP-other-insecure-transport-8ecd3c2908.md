# [MEDIUM] Privileged database fallback disables TLS certificate verification

**File:** [`scripts/ensure-auth-user.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/ensure-auth-user.ts#L71-L78) (lines 71, 72, 73, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-transport`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

When SUPABASE_DB_URL or DATABASE_URL is present, the fallback pg client connects with ssl.rejectUnauthorized set to false. That disables server certificate verification for a privileged database connection used to query auth.users. An active network attacker could impersonate the database endpoint and capture database credentials or auth user data when this fallback path is used.

## Recommendation

Do not disable certificate verification. Use Supabase's trusted CA with verify-full semantics, configure pg with a CA bundle, or remove the direct database fallback and rely on the Supabase Admin API.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
