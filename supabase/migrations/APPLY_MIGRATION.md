# Migration Application Guide

**Migration**: `20250115071800_add_booking_confirmation_token.sql`

---

## Pre-Deployment Checklist

- [ ] Code review completed for migration SQL
- [ ] Rollback script tested (on staging clone)
- [ ] Team notified of upcoming schema change
- [ ] Backup strategy confirmed
- [ ] Estimated downtime: **None** (backward compatible)

---

## Apply to Staging

### Step 1: Push Migration

```bash
# Navigate to project root
cd /Users/amankumarshrestha/Downloads/SajiloReserveX

# Push migration to remote Supabase (staging)
npx supabase db push --remote --include-all
```

**Expected Output**:

```
Applying migration 20250115071800_add_booking_confirmation_token.sql...
✔ Migration applied successfully
```

### Step 2: Verify Schema Changes

Connect to Supabase SQL Editor (staging) and run:

```sql
-- Verify columns exist
\d+ public.bookings;

-- Or use information_schema
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
  AND column_name LIKE 'confirmation_%'
ORDER BY ordinal_position;
```

**Expected Result**:
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| confirmation_token | character varying | YES | NULL |
| confirmation_token_expires_at | timestamp with time zone | YES | NULL |
| confirmation_token_used_at | timestamp with time zone | YES | NULL |

### Step 3: Verify Constraints & Indexes

```sql
-- Check unique constraint
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass
  AND conname = 'bookings_confirmation_token_unique';

-- Check index
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'bookings'
  AND indexname = 'idx_bookings_confirmation_token';
```

### Step 4: Update TypeScript Types

```bash
# Regenerate types from remote schema
npx supabase gen types typescript --remote > types/supabase.ts

# Verify types updated
grep -A 3 "confirmation_token" types/supabase.ts
```

**Expected Output**:

```typescript
confirmation_token: string | null;
confirmation_token_expires_at: string | null;
confirmation_token_used_at: string | null;
```

### Step 5: Test Backward Compatibility

```bash
# Test that existing booking creation still works
curl -X POST https://staging.your-domain.com/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-20",
    "time": "19:00",
    "party": 4,
    "bookingType": "dinner",
    "seating": "any",
    "name": "Migration Test",
    "email": "test@example.com",
    "phone": "+1234567890"
  }'

# Should return 201 with booking object
# confirmation_token should be null (not yet implemented in code)
```

---

## Apply to Production

**⚠️ IMPORTANT**: Only apply after:

1. Code changes deployed to staging
2. End-to-end testing passed
3. Sign-off from team lead

### Step 1: Announce Maintenance Window

**Message Template**:

```
🔧 Schema Update: Non-breaking change
Time: [Date/Time]
Duration: ~1 minute
Impact: None - backward compatible
Details: Adding optional columns to bookings table
```

### Step 2: Apply Migration

```bash
# Switch to production remote
export SUPABASE_URL=<production-url>
export SUPABASE_ANON_KEY=<production-key>

# Push migration
npx supabase db push --remote --include-all
```

### Step 3: Verify (Same as Staging)

Run verification queries from Step 2-3 above.

### Step 4: Update Production Types

```bash
# Regenerate from production
npx supabase gen types typescript --remote > types/supabase.ts

# Commit updated types
git add types/supabase.ts
git commit -m "chore: update Supabase types after confirmation token migration"
```

### Step 5: Monitor

Watch for:

- No increase in booking creation errors
- Schema change completed in < 5 seconds
- No connection pool exhaustion

```sql
-- Check recent bookings (should have null tokens until code deployed)
SELECT
  id,
  reference,
  confirmation_token,
  created_at
FROM public.bookings
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Post-Migration

### Deploy Code Changes

After migration is applied and verified:

1. **Deploy API changes** (token generation in POST /api/bookings)
2. **Deploy confirmation endpoint** (GET /api/bookings/confirm)
3. **Deploy frontend changes** (/thank-you page, middleware update)
4. **Test end-to-end flow** (booking → token → confirmation)

### Monitoring Queries

```sql
-- Token generation rate (should match booking rate after code deploy)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_bookings,
  COUNT(confirmation_token) as bookings_with_token,
  ROUND(100.0 * COUNT(confirmation_token) / COUNT(*), 2) as token_percentage
FROM public.bookings
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Token usage (after code deploy)
SELECT
  COUNT(*) FILTER (WHERE confirmation_token IS NOT NULL) as generated,
  COUNT(*) FILTER (WHERE confirmation_token_used_at IS NOT NULL) as used,
  COUNT(*) FILTER (WHERE confirmation_token_expires_at < NOW()
    AND confirmation_token_used_at IS NULL) as expired,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confirmation_token_used_at IS NOT NULL)
    / NULLIF(COUNT(*) FILTER (WHERE confirmation_token IS NOT NULL), 0), 2) as usage_rate
FROM public.bookings
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## Rollback Procedure

### When to Rollback

- Critical bugs in token generation/validation
- Performance degradation observed
- Schema conflict discovered

### Rollback Steps

```bash
# 1. Revert code changes (deploy previous version)
git revert <commit-hash>
git push origin main

# 2. Wait for all active tokens to expire (1 hour max)

# 3. Execute rollback SQL
# Connect to Supabase SQL Editor and run:
```

```sql
-- From: 20250115071800_add_booking_confirmation_token_rollback.sql

-- Drop index
DROP INDEX IF EXISTS public.idx_bookings_confirmation_token;

-- Remove unique constraint
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_confirmation_token_unique;

-- Drop columns
ALTER TABLE public.bookings
DROP COLUMN IF EXISTS confirmation_token,
DROP COLUMN IF EXISTS confirmation_token_expires_at,
DROP COLUMN IF EXISTS confirmation_token_used_at;
```

```bash
# 4. Regenerate types
npx supabase gen types typescript --remote > types/supabase.ts

# 5. Verify rollback
psql <connection-string> -c "\d+ public.bookings"
# Confirmation columns should be absent
```

---

## Troubleshooting

### Issue: Migration Fails with "column already exists"

**Cause**: Migration already partially applied

**Fix**:

```sql
-- Check current state
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name LIKE 'confirmation_%';

-- If columns exist, migration is already applied
-- No action needed
```

### Issue: Unique Constraint Violation

**Cause**: Extremely rare collision in token generation

**Fix**: This shouldn't happen (32 bytes = 2^256 combinations), but if it does:

```typescript
// In token generation code, retry on constraint violation
try {
  await supabase
    .from('bookings')
    .update({
      confirmation_token: token,
      // ...
    })
    .eq('id', bookingId);
} catch (error) {
  if (error.code === '23505') {
    // unique_violation
    // Regenerate token and retry
  }
}
```

### Issue: Index Not Created

**Cause**: Large table size, timeout

**Fix**:

```sql
-- Create index with CONCURRENTLY (doesn't lock table)
CREATE INDEX CONCURRENTLY idx_bookings_confirmation_token
ON public.bookings(confirmation_token)
WHERE confirmation_token IS NOT NULL;
```

---

## Sign-off

**Staging**:

- [ ] Migration applied: \_\_\_ (Date/Time)
- [ ] Verification passed: \_\_\_ (Engineer)
- [ ] Types updated: \_\_\_ (Commit hash)

**Production**:

- [ ] Migration applied: \_\_\_ (Date/Time)
- [ ] Verification passed: \_\_\_ (Engineer)
- [ ] Types updated: \_\_\_ (Commit hash)
- [ ] Monitoring confirmed: \_\_\_ (24h post-deployment)

---

**Last Updated**: 2025-01-15  
**Contact**: Team Lead for questions
