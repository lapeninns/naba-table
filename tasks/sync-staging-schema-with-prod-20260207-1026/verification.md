---
task: sync-staging-schema-with-prod
timestamp_utc: 2026-02-07T10:26:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Verification Report

## Connectivity

- [x] Production DB connectivity OK (used `pg_dump` against `vrdiqfudmwydclqpydee`)
- [x] New staging DB connectivity OK (used pooler host for `ndxmivcrehsacuerwxtm` due to transient DNS)

## Dry-run

- N/A (schema/data sync performed via Postgres dump/restore)

## Apply

- [x] Production `public` schema restored into new staging project `ndxmivcrehsacuerwxtm`
- [x] Config-only data seeded (restaurants + inventory + scheduling + rules/catalog tables)

## Spot-checks

- [x] `public.restaurants` exists and contains rows
- [x] `public.table_inventory` exists and contains rows
- [x] `public.restaurant_operating_hours` exists and contains rows
- [x] No customer/booking data copied into staging (explicit counts == 0)
- [x] Auth bootstrap user created and granted restaurant access via `public.restaurant_memberships` (4 rows)
- [x] Imported production restaurant staff (owner/manager roles) into staging with fresh passwords and memberships
- [x] Auth/RLS smoke test succeeded for imported staff via `node --import tsx scripts/staging/smoke-auth-from-creds.ts`
- [x] Granted `amanshresthaaaaa@gmail.com` owner access to all restaurants (memberships: 4)

## Artifacts

- Project bootstrap:
  - `artifacts/new_staging_project.json`
  - `artifacts/new_staging_project_ref.txt`
  - `artifacts/new_staging_url.txt`
  - `artifacts/new_staging_anon_key.txt` (redacted: no secrets stored)
  - `artifacts/new_staging_api_keys_redacted.json` (no secrets)
- Schema dump/restore logs:
  - `artifacts/prod_schema_dump.log`
  - `artifacts/staging_schema_restore.log`
- Data seed logs:
  - `artifacts/prod_core_config_seed_dump.log`
  - `artifacts/staging_core_config_seed_restore.log`
  - `artifacts/prod_secondary_config_seed_dump.log`
  - `artifacts/staging_secondary_config_seed_restore.log`
- Safety and correctness checks:
  - `artifacts/staging_spot_checks.txt`
  - `artifacts/staging_truncate_before_reseed.log`
- Auth bootstrap:
  - `artifacts/bootstrap_owner_log.txt`

## Secrets Handling Notes

- Staff passwords are generated for staging and stored in a gitignored file under `backups/` (not committed).
