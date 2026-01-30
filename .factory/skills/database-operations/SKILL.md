---
name: Database Operations
description: Guidelines for Supabase database operations, migrations, and data management. Covers remote-only policy and safety procedures.
triggers:
  - database
  - migration
  - supabase
  - schema
  - sql
---

# Database Operations Skill

This skill provides guidance for database operations in the Nab a Table platform.

## Critical: Remote Only Policy

**Never run local Supabase instances.** All database operations target remote environments:

- `staging` - For development and testing
- `production` - For live data (requires approval)

## Key Files

| Component        | Location               |
| ---------------- | ---------------------- |
| Migrations       | `supabase/migrations/` |
| Type Definitions | `types/supabase.ts`    |
| Supabase Client  | `server/supabase.ts`   |
| DB Scripts       | `scripts/db/`          |

## Environment Configuration

```bash
# Required environment variables
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_DB_URL=postgresql://...
DB_TARGET_ENV=staging|production
```

## Common Commands

```bash
# Check migration status
pnpm db:status

# Apply migrations (staging)
pnpm db:migrate

# Check for schema drift
pnpm db:check-drift

# Pull schema from remote
pnpm db:pull

# Push migrations to remote
pnpm db:push
```

## Migration Guidelines

### Creating a Migration

1. Create file: `supabase/migrations/YYYYMMDD_description.sql`
2. Use idempotent statements where possible
3. Include rollback comments
4. Test on staging first

### Migration Naming

```
20260130_add_user_preferences.sql
20260130_alter_bookings_add_notes.sql
20260130_create_audit_log_table.sql
```

### Safe Migration Patterns

```sql
-- Add column (safe)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index concurrently (safe)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_date
ON bookings(booking_date);

-- Backfill with batching (safe)
UPDATE bookings SET notes = '' WHERE notes IS NULL LIMIT 1000;
```

### Dangerous Operations

- `DROP TABLE` - Requires backup verification
- `ALTER TABLE ... DROP COLUMN` - Data loss risk
- `TRUNCATE` - Data loss risk
- Large `UPDATE` without `LIMIT` - Lock risk

## Safety Procedures

### Before Production Migration

1. [ ] Tested on staging
2. [ ] Backup verified (PITR enabled)
3. [ ] Rollback plan documented
4. [ ] Change window scheduled
5. [ ] On-call acknowledged

### After Migration

1. [ ] Verify data integrity
2. [ ] Check application health
3. [ ] Monitor error rates
4. [ ] Update types: `pnpm db:pull`

## Troubleshooting

### Schema Drift Detected

```bash
# Check what's different
pnpm db:check-drift

# Pull current schema
pnpm db:pull

# Review and apply fixes
```

### Connection Issues

1. Verify environment variables
2. Check Supabase dashboard status
3. Review connection pool limits
4. Check IP allowlist if applicable
