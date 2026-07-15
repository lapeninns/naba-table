# Supabase remote policy

Supabase is remote-only. `README.md`, `scripts/db/safe-run.ts`, and `scripts/validate-env.ts` describe staging-first behavior and block unsafe production resource use in non-production unless explicit overrides are present.

## Practical implications

- Do not describe or rely on a local Supabase workflow.
- Record `APP_ENV`, `DB_TARGET_ENV`, and target class before Supabase/data-path work.
- Run `pnpm validate:env` when an environment-backed verification path is required and available.
- Mutating scripts must default to dry run or guarded confirmation and require a target restaurant/environment where applicable.
- Read-replica preview behavior depends on `SUPABASE_READ_REPLICA_URL` and `FEATURE_SERVICE_CLIENT_USE_READ_REPLICA`.

Related: [Configuration](../reference/configuration.md), [Security](../security.md).
