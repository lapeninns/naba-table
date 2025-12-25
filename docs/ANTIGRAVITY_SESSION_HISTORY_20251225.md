# Antigravity Session History - 2025-12-25

## Session: Fix Bar Tables Booking Type Constraint

**Date**: 2025-12-25  
**Time**: 00:19 - 00:30 UTC  
**Issue**: Bar tables blocked for lunch/dinner bookings

---

## Problem

Application logs showed the following error during booking creation:

```
[bookings][POST][inline-auto-assign] confirm error {
  bookingId: '1c14573b-599a-4203-a314-1c26ba696802',
  error: 'Bar tables are drinks-only; booking_type lunch is not allowed'
}
```

The error occurred during the `atomicConfirmAndTransition` step when the system tried to confirm a table hold for a lunch booking on a bar table.

---

## Root Cause Analysis

### Investigation Steps

1. **Searched codebase** for the error message - not found in application code
2. **Traced the error** through `atomicConfirmAndTransition` → `confirmHoldAssignment` → `confirm_hold_assignment_tx` RPC
3. **Queried Supabase database** to find the constraint source:

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc ILIKE '%drinks-only%'
   OR prosrc ILIKE '%Bar tables are%';
```

### Root Cause

Found a **trigger function** `enforce_bar_drinks_only` that blocks non-drinks bookings on bar tables:

```sql
-- The problematic function
CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS TRIGGER AS $$
DECLARE
  v_booking_type bookings.booking_type%TYPE;
  v_table_category table_inventory.category%TYPE;
  v_zone_name text;
BEGIN
  SELECT b.booking_type INTO v_booking_type
  FROM public.bookings b
  WHERE b.id = NEW.booking_id
  LIMIT 1;

  IF v_booking_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.category, z.name
  INTO v_table_category, v_zone_name
  FROM public.table_inventory t
  LEFT JOIN public.zones z ON z.id = t.zone_id
  WHERE t.id = NEW.table_id
  LIMIT 1;

  IF v_table_category IS NULL THEN
    RETURN NEW;
  END IF;

  -- THIS IS THE CONSTRAINT CAUSING THE ERROR:
  IF (v_table_category = 'bar'::public.table_category OR v_zone_name ILIKE 'bar%')
     AND v_booking_type <> 'drinks' THEN
    RAISE EXCEPTION 'Bar tables are drinks-only; booking_type % is not allowed', v_booking_type
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The function checks **BOTH**:

- Table category = 'bar'
- OR zone name starts with 'bar%'

If either condition is true AND booking_type ≠ 'drinks', it raises an exception.

---

## Solution

### Option A: Disable the Trigger (Quick fix)

```sql
-- First, find the trigger
SELECT
    tgname as trigger_name,
    relname as table_name,
    tgenabled as enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE p.proname = 'enforce_bar_drinks_only';

-- Then disable it
ALTER TABLE public.TABLE_NAME DISABLE TRIGGER TRIGGER_NAME;
```

### Option B: Replace Function with No-op (Permanent fix - RECOMMENDED)

```sql
CREATE OR REPLACE FUNCTION public.enforce_bar_drinks_only()
RETURNS TRIGGER AS $$
BEGIN
  -- Bar table restriction REMOVED (Dec 2024)
  -- Bar tables and bar zones can now be used for any booking type (lunch, dinner, drinks)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Related Context

- **Previous Fix Attempt**: Conversation `38f56f10-fdbe-45b1-ba85-64df940c06ee` (2024-12-24) attempted to fix this for dinner bookings
- **Documentation**: `docs/BUSINESS_LOGIC.md` line 637-638 states bar restriction was removed, but DB was never updated
- **Migration File**: `migrations/fix_bar_tables_for_all_bookings.sql` - incomplete, only changed table categories

---

## Files Modified/Created

1. **Created**: `migrations/fix_bar_tables_constraint_complete.sql` - complete diagnostic and fix queries

---

## Verification

After applying the fix, verify with:

```sql
-- Confirm function was updated
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'enforce_bar_drinks_only';

-- Test a lunch booking on bar table (should succeed now)
```

---

## Lessons Learned

1. **Database constraints must be updated** alongside application code and documentation
2. The constraint was in TWO places: table category AND zone name - both needed consideration
3. Previous "fix" only addressed table categories, not the trigger function

---

## Migration Status

**Applied**: 2025-12-25T00:43:38Z  
**Script**: `CONSOLIDATED_DATABASE_FIXES_20251223-25.sql`

All 7 sections completed successfully:

- ✅ Section 1: Extensions schema configured
- ✅ Section 2: Function search paths secured (34+)
- ✅ Section 3: audit_logs table created
- ✅ Section 4: RLS enabled on 7 tables
- ✅ Section 5: RLS policies optimized
- ✅ Section 6: Duplicate policies removed
- ✅ Section 7: Bar table constraint removed

---

## Tags

`#database` `#supabase` `#trigger` `#booking-constraint` `#bar-tables`
