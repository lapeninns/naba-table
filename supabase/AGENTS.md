---
agents_version: 5.4
scope: subproject
extends: ../AGENTS.md
last_updated: 2026-02-06
owner: github:@amanshresthaa
profile: db
---

# AGENTS.md - Supabase migrations (`supabase`)

Applies to SQL migrations under `supabase/migrations/**`.

## Rules

- Supabase is remote-only. Do not run local Supabase.
- Use `pnpm db:*` scripts or Supabase MCP for migration planning and apply.
- Staging first, then production in a change window.
- Include rollback steps and a dry-run diff in task artifacts.
- Avoid long locking migrations; prefer expand/backfill/contract.

## Staging / preview: production-shaped data (read replica)

Supabase [read replicas](https://supabase.com/docs/guides/platform/read-replicas) are part of the **same project** as the primary: you reuse the **same** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, but reads can go to a dedicated replica API host so they stay read-only at the storage layer.

### Recommended wiring (this repo)

1. In the Supabase dashboard, enable a read replica on the **production** project and copy the replica **API URL** (REST host), not the Postgres connection string.
2. On the **staging** or **preview** Vercel deployment, set:
   - `NEXT_PUBLIC_SUPABASE_URL` — the **primary** project API URL (Auth, cookies, and middleware keep using this).
   - `SUPABASE_READ_REPLICA_URL` — the replica API URL from step 1.
   - `FEATURE_SERVICE_CLIENT_USE_READ_REPLICA`=`true`
   - Optional: `OPS_ENV_BANNER` — short text shown at the top of Ops; when set, it replaces the default read-replica notice.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` (and anon key) as the **production** project keys; they are valid against the replica host.
4. Run `pnpm exec tsx scripts/validate-env.ts` with the same env before shipping so misconfiguration is caught early.

**Runtime behavior:** `getServiceSupabaseClient()` and `getTenantServiceSupabaseClient()` use `SUPABASE_READ_REPLICA_URL` when the feature flag is on (non-production deployment targets only). **Writes may fail** against a replica; that is expected if the goal is read-only preview of production lists and dashboards.

**Safety:** The replica switch is **ignored** when `APP_ENV=production` or `VERCEL_ENV=production`, so the live production web app does not accidentally route the service client to a replica.

### Alternative (not read-only)

To point a lower environment at the production **primary** URL (reads and writes), align `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` with production and set `ALLOW_PROD_RESOURCES_IN_NONPROD=true` so `scripts/validate-env.ts` allows it. That is **not** read-only and is higher risk.

### Local `/dev` harness routes

Those pages use in-memory mocks (`src/app/(public)/dev/**`); they are unaffected by replica env vars. Use the deployed staging Ops app to preview real data.
