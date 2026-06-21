# [HIGH_BUG] Staging safety validates a different Supabase URL than the service client may use

**File:** [`scripts/seed-restaurant.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/seed-restaurant.ts#L64-L143) (lines 64, 66, 137, 143)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-target-safety-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The script's staging guard validates NEXT_PUBLIC_SUPABASE_URL, then creates the service-role client through getServiceSupabaseClient(). That helper can switch the actual service client to SUPABASE_READ_REPLICA_URL when FEATURE_SERVICE_CLIENT_USE_READ_REPLICA=true on non-production targets. As a result, a mixed local/CI environment can pass the staging project-ref and confirmation checks while the restaurant creation RPC runs against a different Supabase project. In the worst case this can seed a production project while the operator believes the script is constrained to staging. The imported safety helper also only compares the first hostname label for API URLs, so it should not be the only check for the URL that will receive the service-role key.

## Recommendation

For mutating scripts, validate the exact URL used by the service-role client, or construct the service client from the already-validated URL. Reject alternate service URLs unless their project ref and hostname suffix are explicitly verified as the expected Supabase project, and consider disabling read-replica routing for write scripts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
