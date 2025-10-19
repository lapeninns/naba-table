# 📦 Supabase Schema Export Guide

Export a clean, well-organized snapshot of your Supabase database without guessing which command to run next.

## 🎯 What You Get

- ✅ Full schema backup (tables, functions, triggers, policies)
- ✅ Split-out SQL files for each object type and table
- ✅ Ready-to-commit migrations or documentation artifacts
- ✅ Remote-only workflows that honor project policies

---

## 🔧 Prerequisites

### CLI & Access

```bash
# Install Supabase CLI (choose one)
npm install -g supabase
brew install supabase/tap/supabase

# Verify version
supabase --version
```

- Supabase account with access to the target project.
- Remote database password (find it in Supabase Dashboard → Settings → Database).
- Local PostgreSQL tools (`psql`, `pg_dump`) installed.

### Remote Safety First

> ⚠️ Supabase policy: migrations, seeds, and dumps must target the **remote** instance.  
> Double-check the database URL before running any destructive commands.

Set a reusable environment variable to avoid leaking credentials into history:

```bash
export SUPABASE_DB_URL="$(supabase db dump --db-url)"
# Optional: confirm the host references *.supabase.co
echo "$SUPABASE_DB_URL" | sed 's/:\/\/.*@/:\/\/***@/'
```

---

## Step 1 — Authenticate & Link

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

How to find `YOUR_PROJECT_REF`:

- Supabase Dashboard → Settings → General → Reference ID.

Once linked, the CLI stores credentials in `~/.supabase`, so future commands just work.

---

## Step 2 — Pull a Snapshot of the Remote Schema

```bash
supabase db pull
```

- Outputs a timestamped migration file under `supabase/migrations/`.
- Useful for diffing remote changes before exporting targeted slices.
- Seeing `prepared statement "..." already exists`? Run `psql "$SUPABASE_DB_URL" -c "DEALLOCATE ALL;"` to clear cached statements on the pooled connection, then rerun the pull.

---

## Step 3 — Dump the Schema

### Option A: Single-File Exports

```bash
# Everything (schema + routines + policies)
supabase db dump --schema public > complete_schema.sql

# Schema-only (no data) while keeping Supabase objects
supabase db dump --schema public --data-only=false > schema_only.sql

# Strip Supabase-managed tables (auth/storage/realtime)
supabase db dump \
  --schema public \
  --exclude-table='auth.*' \
  --exclude-table='storage.*' \
  --exclude-table='realtime.*' \
  --data-only=false > clean_public_schema.sql
```

### Option B: Organized Directory Structure (Use this)

```bash
mkdir -p schema/{tables,functions,triggers,policies,indexes}

# Tables (schema only)
supabase db dump --schema-only --table='*' > schema/tables/tables.sql

# Functions
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --section=pre-data \
  | grep -A 100 "CREATE FUNCTION" > schema/functions/functions.sql

# Triggers
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  | grep -A 20 "CREATE TRIGGER" > schema/triggers/triggers.sql

# Indexes (optional)
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --section=post-data \
  | grep -A 10 "CREATE INDEX" > schema/indexes/indexes.sql
```

---

## Step 4 — Export Individual Tables

```bash
mkdir -p schema/tables/individual

# List public tables
psql "$SUPABASE_DB_URL" -c "\dt public.*" -t | awk '{print $3}' > table_list.txt

# Dump each table definition separately
while read -r table; do
  supabase db dump --schema-only --table="$table" > "schema/tables/individual/${table}.sql"
done < table_list.txt
```

Tip: commit `table_list.txt` if you want a quick audit trail of exported tables.

---

## Step 5 — Extract Row Level Security (RLS) Policies

```bash
mkdir -p schema/policies

psql "$SUPABASE_DB_URL" <<'SQL' > schema/policies/rls_policies.txt
SELECT
    schemaname || '.' || tablename AS table_name,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY schemaname, tablename, policyname;
SQL
```

Consider pairing this output with `schema/functions/functions.sql` to ensure policies reference the expected helper routines.

---

## Step 6 — Automate the Workflow

Skip the copy/paste marathons. The repo ships with `scripts/organize_schema.sh`, which runs the full export pipeline and splits output by object type.

```bash
SUPABASE_DB_URL="postgres://..." scripts/organize_schema.sh \
  --export-dir ./exported_schema \
  --schema public \
  --skip-pull        # optional: skips supabase db pull if you just pulled
```

What it does:

- Validates the remote schema exists and masks credentials in logs.
- Optionally runs `supabase db pull` so you have a migration snapshot for diffing.
- Writes `complete_schema.sql` + `schema_only.sql` (Steps 3A & 3B).
- Extracts tables, views, types, indexes, triggers, functions, and policies into dedicated folders.
- Generates individual table files with `pg_dump` and exports an RLS matrix via `psql`.
- Uses native `pg_dump`/`psql`, so Docker is not required for the canonical dumps.

> 🔁 Schedule the script (GitHub Actions, cron, etc.) for recurring snapshots.  
> Remember: store `SUPABASE_DB_URL` in a secure secret store—never commit it.

---

## Step 7 — Prepare Migration-Ready Files

```bash
supabase init                     # scaffolds supabase/ folder if absent
cp exported_schema/schema_only.sql supabase/migrations/00000000000000_initial_schema.sql
```

To validate the migration, run the reset against a **non-production** environment:

```bash
supabase db reset --db-url "$SUPABASE_DB_URL"
```

> ⚠️ `supabase db reset` truncates data. Only run this against staging or an isolated remote clone. Coordinate with your team before resetting shared environments.

---

## Troubleshooting & Tips

- **Authentication issues** → `supabase login` again; ensure the access token has the correct scopes.
- **Permission errors** → Use the database password from Dashboard → Settings → Database.
- **Prepared statement errors during `db pull`** → Clear the pooled cache with `psql "$SUPABASE_DB_URL" -c "DEALLOCATE ALL;"` and rerun.
- **Large databases** → Stream through gzip: `supabase db dump --schema public | gzip > schema.sql.gz`.
- **Audit documentation** → `psql "$SUPABASE_DB_URL" -c "\d+" > schema_documentation.txt`.

---

## Quick Reference Commands

```bash
supabase db dump --db-url                   # Print connection string (keep it secret!)
psql "$SUPABASE_DB_URL" -c "\dt"            # List tables
psql "$SUPABASE_DB_URL" -c "\d table_name"  # Describe a table
supabase db dump --format=custom > db.dump  # Custom-format archive
supabase db reset --db-url "$SUPABASE_DB_URL" < schema.sql  # Restore snapshot
```

---

## Related Docs

- [`QUICK_START_SUPABASE.md`](./QUICK_START_SUPABASE.md) — one-command reset overview.
- [`REMOTE_ONLY_SETUP.md`](./REMOTE_ONLY_SETUP.md) — remote policy recap.
- [`docs/database/migrations-and-patches.md`](./docs/database/migrations-and-patches.md) — migration registry & patch history.
- [`scripts/backup-remote-db.sh`](./scripts/backup-remote-db.sh) — automated remote backups (pair with exports).

Keep this guide version-controlled in `tasks/` directories or shared runbooks so every export is traceable. Happy dumping! 🎉
