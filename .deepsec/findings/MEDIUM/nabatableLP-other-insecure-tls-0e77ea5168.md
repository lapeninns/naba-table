# [MEDIUM] Direct Postgres connection disables certificate verification

**File:** [`scripts/import-old-school-house-drinks-staging.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/import-old-school-house-drinks-staging.ts#L227-L230) (lines 227, 230)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-insecure-tls`

## Finding

The script connects to the direct/pooler Postgres URL with ssl.rejectUnauthorized set to false. Because that connection carries database credentials and performs service-level writes, a network or DNS MITM could impersonate the database endpoint, capture credentials, or tamper with read/write results.

## Recommendation

Remove rejectUnauthorized: false; use normal TLS verification or configure the Supabase CA/expected host explicitly. Fail closed if the pooler URL cannot be verified as a Supabase endpoint.

## Revalidation

**Verdict:** fixed

The file named in the finding is absent from the current working tree and from `HEAD`. Git shows it was deleted by commit `72bb7412`, so the direct Postgres fallback described here is not executable from this script anymore. Because the target file is gone, its former `ssl.rejectUnauthorized: false` setting cannot be reached by an operator running the current codebase. I also checked for the old drink-menu importer markers and did not find a live renamed version. This finding is fixed for the target path.
