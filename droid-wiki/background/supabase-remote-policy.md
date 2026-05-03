# Supabase remote policy

Supabase is remote-only. `README.md`, `AGENTS.md`, `scripts/db/safe-run.ts`, and `scripts/validate-env.ts` require staging-first behavior and block unsafe production resource use in non-production unless explicit overrides are present.

Related: [Configuration](../reference/configuration.md).
