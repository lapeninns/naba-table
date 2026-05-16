# [MEDIUM] Privileged Postgres connection disables TLS certificate verification

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L227-L230) (lines 227, 228, 229, 230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `insecure-crypto`

## Finding

The pg client sets ssl.rejectUnauthorized to false while using the database password derived from SUPABASE_DB_URL/DATABASE_URL. This still encrypts traffic, but it does not authenticate the Supabase server, so a DNS/network MITM could impersonate the database endpoint and capture credentials or queries.

## Recommendation

Use certificate-verifying TLS for Postgres connections, ideally verify-full semantics with Supabase's CA bundle or the platform trust store. Do not disable rejectUnauthorized for scripts that carry service-role or database credentials.

## Revalidation

**Verdict:** fixed

The target script containing the reported privileged Postgres client does not exist in current HEAD. Git confirms the path was removed in commit `72bb7412`, after the security-sprint commit that touched it. With the file deleted, there is no current `pg` connection in this target path that can set `ssl.rejectUnauthorized` to `false` or carry this importer's database credentials. I did not find a renamed drink-menu importer using the same source path or import RPC patterns under `scripts/`. This specific TLS-verification finding is fixed because the vulnerable connection path is gone.
