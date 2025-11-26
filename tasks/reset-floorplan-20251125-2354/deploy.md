---
task: reset-floorplan
timestamp_utc: 2025-11-26T00:00:00Z
owner: github:@assistant
reviewers: [github:@assistant]
risk: medium
flags: []
related_tickets: []
---

# Deployment Instructions (Staging first)

This document outlines the commands and steps to apply the migration, reseed the White Horse Pub zones/tables, and run sanity checks — always run in a staging environment first.

# Preflight

- Ensure you have access to the staging Supabase instance.
- Ensure `SUPABASE_DB_URL` points to the staging DB (not production). Example value is a Postgres DSN: `postgresql://...`.
- Ensure the user has the privileges to create triggers and write to the database.
- Ensure Supabase or the hosted Postgres has a backup or PITR enabled and that you can restore.

# Recommended flow

1. Verify the target is staging: export the env var and inspect it

   ```bash
   export SUPABASE_DB_URL="<your_staging_db_url>"
   echo "$SUPABASE_DB_URL"
   ```

2. Dry run (shows commands):

   ```bash
   bash scripts/apply_supabase_order.sh --env staging --dry-run
   ```

3. If `pg_dump` is available (recommended), take a backup before applying:

   ```bash
   mkdir -p backups
   pg_dump --format=p --no-owner --no-acl --file backups/pre-apply-$(date -u +%Y%m%dT%H%M%SZ).sql "$SUPABASE_DB_URL"
   ```

4. Apply to staging (confirm):

   ```bash
   bash scripts/apply_supabase_order.sh --env staging --confirm
   ```

5. Run sanity checks:

   ```bash
   psql "$SUPABASE_DB_URL" -f tasks/reset-floorplan-20251125-2354/artifacts/sanity-queries.sql
   ```

6. Validate application behavior (e.g., use `droid`, booking flows, or UI smoke tests). If anything looks wrong, restore backup.

# Rollback

- If you created a `pg_dump` backup, restore:

  ```bash
  bash scripts/restore_supabase_backup.sh backups/pre-apply-<timestamp>.sql
  ```

- If you cannot restore using a backup, contact DBA/infra support and follow the project backup/restore SOP.

# Notes

- This script applies an idempotent SQL migration and seed as implemented in the project. If you want to make changes, add a migration file and change the script accordingly.
- Confirm the trigger added in the migration is expected — it prohibits booking types other than 'drinks' from being assigned to bar tables.
- Update `tasks/reset-floorplan-20251125-2354/verification.md` with the output from the sanity queries and any artifacts (Lighthouse, HAR, db diffs).
