# Capacity Engine Migrations

**Created:** 2025-10-16  
**Story:** Capacity & Availability Engine - Story 1  
**Status:** Ready for Testing

---

## Migration Files (In Order)

1. **`20251016091800_create_table_inventory.sql`**
   - Creates `table_inventory` table for physical restaurant tables
   - Adds `table_status` enum (available, reserved, occupied, out_of_service)
   - Includes RLS policies, indexes, triggers
   - **Dependencies:** restaurants table
   - **Affects:** Ops dashboard (table management UI)

2. **`20251016091900_create_booking_slots.sql`**
   - Creates `booking_slots` table for time slot capacity tracking
   - Includes optimistic locking (version column)
   - Adds helper function `get_or_create_booking_slot()`
   - **Dependencies:** restaurants, restaurant_service_periods
   - **Affects:** Availability checks

3. **`20251016092000_create_booking_table_assignments.sql`**
   - Creates `booking_table_assignments` junction table
   - Links bookings to physical tables
   - Adds helper functions `assign_table_to_booking()`, `unassign_table_from_booking()`
   - Includes audit trail logging
   - **Dependencies:** bookings, table_inventory, booking_slots
   - **Affects:** Table assignment workflow

4. **`20251016092100_add_capacity_check_rpc.sql`** ⚠️ **CRITICAL**
   - Creates `create_booking_with_capacity_check()` RPC function
   - Implements SERIALIZABLE transaction with row-level locking
   - Enforces capacity limits before booking creation
   - **Dependencies:** bookings, restaurant_capacity_rules, restaurant_service_periods
   - **Affects:** POST /api/bookings endpoint (when feature flag enabled)

5. **`20251016092200_capacity_engine_rollback.sql`** (Optional)
   - Rollback script to undo all changes
   - **Only run if you need to rollback**

---

## Pre-Migration Checklist

Before applying these migrations:

- [ ] **Backup database** (critical!)
- [ ] Review all migration SQL files
- [ ] Verify existing schema compatibility
- [ ] Ensure Supabase CLI is up to date: `supabase --version`
- [ ] Test on local instance first (NOT production)

---

## Local Testing Instructions

### Step 1: Apply Migrations Locally

```bash
# Navigate to project root
cd /Users/amankumarshrestha/Downloads/SajiloReserveX

# Apply migrations to local Supabase (if running)
supabase db reset  # This will apply all migrations

# OR apply individually
supabase db push
```

### Step 2: Verify Schema Changes

1. Open Supabase Studio: http://localhost:54323
2. Navigate to **Table Editor**
3. Verify new tables exist:
   - `table_inventory`
   - `booking_slots`
   - `booking_table_assignments`
4. Navigate to **Database > Functions**
5. Verify RPC function exists:
   - `create_booking_with_capacity_check`

### Step 3: Test RPC Function

Open **SQL Editor** in Supabase Studio and run:

```sql
-- First, get a test restaurant ID
SELECT id, name, slug FROM restaurants LIMIT 1;

-- Then, test the RPC function
SELECT create_booking_with_capacity_check(
    p_restaurant_id := '<YOUR_RESTAURANT_ID>',
    p_customer_id := '<YOUR_CUSTOMER_ID>',  -- Get from customers table
    p_booking_date := CURRENT_DATE + 1,  -- Tomorrow
    p_start_time := '19:00'::time,
    p_end_time := '21:00'::time,
    p_party_size := 4,
    p_booking_type := 'dinner',
    p_customer_name := 'Test Customer',
    p_customer_email := 'test@example.com',
    p_customer_phone := '+1234567890',
    p_seating_preference := 'any',
    p_notes := 'Test booking via RPC',
    p_marketing_opt_in := false,
    p_idempotency_key := gen_random_uuid()::text,
    p_source := 'test',
    p_auth_user_id := NULL,
    p_client_request_id := 'test-001',
    p_details := '{}'::jsonb,
    p_loyalty_points_awarded := 0
);
```

**Expected Response:**

```json
{
  "success": true,
  "duplicate": false,
  "booking": { "id": "...", "reference": "ABC123XYZ9", ... },
  "capacity": {
    "servicePeriod": "Dinner Service",
    "maxCovers": 80,
    "bookedCovers": 4,
    "availableCovers": 76,
    "utilizationPercent": 5.0
  },
  "message": "Booking created successfully"
}
```

### Step 4: Test Capacity Exceeded Scenario

```sql
-- First, set a low capacity limit for testing
INSERT INTO restaurant_capacity_rules (
    restaurant_id,
    service_period_id,
    max_covers,
    max_parties
)
SELECT
    id,
    (SELECT id FROM restaurant_service_periods WHERE restaurant_id = restaurants.id AND name ILIKE '%dinner%' LIMIT 1),
    10,  -- Very low capacity for testing
    5
FROM restaurants
LIMIT 1;

-- Now try to book 12 people (should exceed capacity of 10)
SELECT create_booking_with_capacity_check(
    p_restaurant_id := '<YOUR_RESTAURANT_ID>',
    p_customer_id := '<YOUR_CUSTOMER_ID>',
    p_booking_date := CURRENT_DATE + 1,
    p_start_time := '19:00'::time,
    p_end_time := '21:00'::time,
    p_party_size := 12,  -- Exceeds capacity!
    p_booking_type := 'dinner',
    p_customer_name := 'Test Customer 2',
    p_customer_email := 'test2@example.com',
    p_customer_phone := '+1234567891',
    p_seating_preference := 'any',
    p_idempotency_key := gen_random_uuid()::text
);
```

**Expected Response:**

```json
{
  "success": false,
  "error": "CAPACITY_EXCEEDED",
  "message": "Maximum capacity of 10 covers exceeded. Currently booked: 4, Requested: 12",
  "details": {
    "maxCovers": 10,
    "bookedCovers": 4,
    "requestedCovers": 12,
    "availableCovers": 6,
    "servicePeriod": "Dinner Service"
  }
}
```

### Step 5: Test Race Condition Handling

Open **two separate SQL Editor tabs** and run this in both simultaneously:

```sql
-- Tab 1 & Tab 2: Run at the same time (Ctrl+Enter)
SELECT create_booking_with_capacity_check(
    p_restaurant_id := '<SAME_RESTAURANT_ID>',
    p_customer_id := '<SAME_CUSTOMER_ID>',
    p_booking_date := CURRENT_DATE + 2,  -- Day after tomorrow
    p_start_time := '20:00'::time,
    p_end_time := '22:00'::time,
    p_party_size := 10,  -- Both trying to book last 10 seats
    p_booking_type := 'dinner',
    p_customer_name := 'Race Test',
    p_customer_email := 'race@test.com',
    p_customer_phone := '+1111111111',
    p_seating_preference := 'any',
    p_idempotency_key := gen_random_uuid()::text  -- Different keys!
);
```

**Expected:**

- One tab succeeds: `"success": true`
- Other tab fails: `"error": "CAPACITY_EXCEEDED"` or `"BOOKING_CONFLICT"`

---

## Regenerate TypeScript Types

After migrations succeed:

```bash
# Regenerate types from database schema
pnpm db:types

# Or manually:
npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> > types/supabase.ts

# Verify new types exist
grep -A 5 "table_inventory" types/supabase.ts
grep -A 5 "booking_slots" types/supabase.ts
grep -A 5 "booking_table_assignments" types/supabase.ts
```

---

## Production Deployment (DO NOT RUN YET)

⚠️ **Wait for full testing before production deployment**

When ready:

```bash
# 1. Backup production database
supabase db dump -f backup-$(date +%Y%m%d).sql

# 2. Apply migrations to production
supabase db push --linked

# 3. Verify in production Supabase Studio
# 4. Monitor logs for errors
```

---

## Rollback Instructions (Emergency Only)

If something goes wrong:

```bash
# Option 1: Run rollback migration
supabase migration new capacity_engine_rollback
# Copy contents of 20251016092200_capacity_engine_rollback.sql
supabase db push

# Option 2: Restore from backup
supabase db restore backup-YYYYMMDD.sql
```

---

## Troubleshooting

### Issue: "relation does not exist"

**Cause:** Migrations applied out of order  
**Fix:** Run `supabase db reset` to apply all migrations in order

### Issue: "function already exists"

**Cause:** Migration applied twice  
**Fix:** Drop function manually:

```sql
DROP FUNCTION IF EXISTS public.create_booking_with_capacity_check CASCADE;
```

### Issue: "permission denied"

**Cause:** Missing RLS policies  
**Fix:** Verify user has proper role (service_role or authenticated)

### Issue: RPC returns NULL

**Cause:** Missing GRANT EXECUTE permissions  
**Fix:** Verify grants in migration 004

---

## Testing Checklist

- [ ] All migrations apply without errors
- [ ] New tables visible in Supabase Studio
- [ ] RPC function exists and is callable
- [ ] RPC succeeds with valid data
- [ ] RPC rejects when capacity exceeded
- [ ] RPC handles race conditions (concurrent calls)
- [ ] Idempotency works (same key returns existing booking)
- [ ] TypeScript types regenerated successfully
- [ ] No breaking changes to existing booking flow

---

## Next Steps

After successful local testing:

1. ✅ Mark Story 1 as complete in `todo.md`
2. ➡️ Begin Story 2: Build CapacityService (TypeScript)
3. ➡️ Create API integration tests
4. ➡️ Deploy to staging environment

---

## Support

**Questions?** See:

- Main plan: `tasks/capacity-availability-engine-20251016-0905/plan.md`
- Research: `tasks/capacity-availability-engine-20251016-0905/research.md`
- Todo checklist: `tasks/capacity-availability-engine-20251016-0905/todo.md`

**Found a bug?** Document in `tasks/capacity-availability-engine-20251016-0905/verification.md`
