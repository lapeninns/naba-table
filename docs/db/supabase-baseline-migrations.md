# Supabase Baseline + Forward-Only Migrations (Staging + Production)

This project uses **remote-only** Supabase workflows.

We support the operational reality that historical schema changes may have been performed via the Supabase SQL Editor and that staging may be refreshed by cloning production.

The required model is:

1. **Baseline** the remote database (repair migration history metadata).
2. Apply **forward-only** schema changes as Supabase migrations going forward.

## Why Baseline Is Required

Supabase CLI applies migrations by comparing local files in `supabase/migrations/` to the remote table:

- `supabase_migrations.schema_migrations`

If that remote history is empty or mismatched, `supabase db push` will treat **every** local migration file as pending and try to replay them in version order.

This is unsafe against a production-clone schema and can fail immediately (e.g., dropping a table that is referenced by a live FK).

Baselining uses `supabase migration repair` to record metadata only. It does **not** execute the SQL of the historical migrations.

## Hard Requirements (Invariant)

- One migration file per version prefix in `supabase/migrations/`.
  - Supabase identifies migrations primarily by the filename prefix (before `_`).
  - Duplicate version prefixes break `db push`, `db pull`, and `migration list`.
- After a baseline, always run:
  - `supabase db push --linked --dry-run`
  - It must not attempt to replay historical migrations.

## Staging Workflow (After Cloning Production → Staging)

Use this when staging is refreshed from production and **migration history is empty/missing**.

1. Link to staging (once per machine / repo clone):

```bash
supabase link --project-ref <staging_project_ref>
```

2. Validate the local migration directory is CLI-safe:

```bash
bash scripts/supabase/check_migration_versions_unique.sh
```

3. Baseline the remote migration history (metadata only).

Pick a cutoff version that represents the schema state included by the clone.

If you cloned production at commit `X`, the cutoff is typically the latest migration version that existed at `X`.

```bash
# Example: baseline through 20260207144113
bash scripts/supabase/repair_migration_history_linked.sh --through 20260207144113
```

4. Confirm the baseline worked:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Expected: `db push --dry-run` reports remote is up to date.

5. Apply _new_ migrations (deltas only):

```bash
supabase db push --linked
```

6. Regenerate types (recommended after schema changes):

```bash
supabase gen types --linked --lang typescript --schema public,auth > types/supabase.ts
```

## Production Workflow (After Staging Tests)

Production should only receive forward-only migrations after staging is validated.

1. Ensure backup/PITR readiness in Supabase Dashboard (or your ops runbook).
2. Run `check_migration_versions_unique.sh`.
3. If production has missing migration history (common when schema was evolved via SQL Editor):
   - Baseline production exactly once using a safe cutoff that matches the current production schema state.
   - Do not baseline "future" versions that have not been applied.

```bash
bash scripts/supabase/repair_migration_history_linked.sh --through <known_applied_version>
```

4. If production has **remote-only applied migrations** that are not present in `supabase/migrations/`
   (common when changes were done via SQL Editor), `supabase db push` will refuse to run with:
   "Remote migration versions not found in local migrations directory."

   To adopt the "repo migrations are canonical going forward" model, mark those remote-only versions
   as `reverted` (metadata only):

```bash
# Dry-run first to see which remote-only versions would be marked reverted.
bash scripts/supabase/revert_remote_only_migrations_linked.sh --dry-run

# Apply (metadata-only)
bash scripts/supabase/revert_remote_only_migrations_linked.sh
```

4. Dry-run before applying:

```bash
supabase db push --linked --dry-run
```

5. Apply migrations in a change window:

```bash
supabase db push --linked
```

6. Regenerate types and run application validation.

## Suggested Staging Test Checklist (Before Production)

- Database correctness:
  - Confirm app critical paths succeed (booking create, ops dashboard load, table assignment, email flows if enabled).
  - Confirm removed objects are truly absent (e.g., loyalty tables if deprecating features).
- Security:
  - Validate RLS/policy changes with a real authenticated session (least privilege).
  - Confirm internal tables are not readable/writable from client roles (`anon` / `authenticated`) where intended.
- Performance:
  - Run a small load/usage smoke (Ops dashboard list filters, booking list, table assignment flows) and monitor query latency.
- Tooling invariants:
  - `supabase migration list --linked` shows expected applied versions.
  - `supabase db push --linked --dry-run` does not propose replaying historical migrations.

## Type Generation (Patch Required)

Supabase type generation can be overly strict about RPC nullability for certain functions
that legitimately accept/return `NULL` timestamps (for example, booking lifecycle transitions
that clear `checked_in_at` / `checked_out_at`).

After regenerating types, run the patch script to keep the repo's TypeScript invariants correct:

```bash
supabase gen types --linked --lang typescript --schema public,auth > types/supabase.ts
tsx scripts/supabase/patch-generated-types.ts
```

## Production Rollout Checklist (Practical)

- Pre-flight:
  - Confirm production project is linked intentionally (double-check `supabase/.temp/project-ref`).
  - Confirm backups/PITR are available.
  - Run `bash scripts/supabase/check_migration_versions_unique.sh`.
  - Run `supabase db push --linked --dry-run` and ensure the plan matches expectations.
- Baseline (only if needed):
  - If production history is missing/mismatched, baseline using a conservative cutoff:
    - Prefer baselining only through versions you are confident already exist in production.
    - Never baseline versions that include new feature removals or security changes unless you have verified they already exist.
- Apply:
  - Run `supabase db push --linked` in a change window.
  - Monitor error rates and latency during/after.
- Post-flight:
  - Regenerate types and run application checks.
  - Re-run `supabase db push --linked --dry-run` (should be up to date).

## Common Failure Modes

### `CREATE INDEX CONCURRENTLY` fails during `supabase db push`

Supabase CLI applies migrations using pipelined execution. Postgres does not allow
`CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` in a pipeline and will raise:

- `ERROR: CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)`

Fix:

- For migrations applied via Supabase CLI, use non-`CONCURRENTLY` index DDL and schedule
  production index builds/drops in a change window.

### `supabase db push` tries to apply historical migrations

Cause: remote migration history missing or mismatched.

Fix:

- Run baseline/repair through the appropriate cutoff version.
- Confirm with `supabase db push --dry-run`.

### Duplicate migration versions in repo

Cause: multiple files share the same version prefix.

Fix:

- Consolidate to a single canonical file per version prefix.
- Keep any superseded files as task artifacts, not under `supabase/migrations/`.

### `supabase db pull` fails due to Docker

Some Supabase CLI operations (pull/diff/dump) may create a shadow DB using Docker.
If Docker Desktop is not running, those commands can fail.

Baseline and forward-only migration application do **not** require Docker.
