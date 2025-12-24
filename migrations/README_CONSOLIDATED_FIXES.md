# Consolidated Database Fixes - SajiloReserveX

**Generated**: 2025-12-24T18:56:42Z  
**Script**: `CONSOLIDATED_DATABASE_FIXES_20251224.sql`

---

## Overview

This single SQL script contains **ALL database fixes** from the following tasks:

| Task                                        | Date         | Description                                    |
| ------------------------------------------- | ------------ | ---------------------------------------------- |
| `supabase-security-hardening-20251224-1041` | Dec 24, 2025 | Security hardening, RLS, function search paths |
| `guest-booking-access-revamp-20251224-0124` | Dec 24, 2025 | Token system (no SQL changes)                  |
| `customer-phone-duplicate-20251224-0025`    | Dec 24, 2025 | Phone lookup (app code, no SQL)                |
| `fix-booking-time-validation-20251224-0003` | Dec 24, 2025 | Time validation (app code, no SQL)             |

---

## Script Sections

### Section 1: Extensions Schema

**Addresses**: `extension_in_public` warning  
**Risk**: LOW

- Creates dedicated `extensions` schema
- Moves `citext`, `pgcrypto`, `btree_gist` from public schema
- Updates database search_path to `public, extensions`

### Section 2: Function Search Paths

**Addresses**: `function_search_path_mutable` warning (34+ functions)  
**Risk**: LOW

- Sets `search_path = public, extensions` on all custom functions
- Prevents search_path hijacking attacks
- Functions include: `create_booking_with_capacity_check`, `confirm_hold_assignment_tx`, `validate_table_adjacency`, etc.

### Section 3: Missing Tables

**Addresses**: Missing `audit_logs` table  
**Risk**: LOW

- Creates `audit_logs` table required by `confirm_hold_assignment_tx` RPC
- Adds indexes for entity, created_at, action
- Enables RLS with service_role policy

### Section 4: Enable RLS on Unprotected Tables

**Addresses**: `rls_disabled_in_public` ERROR (7 tables)  
**Risk**: MEDIUM

Tables protected:

- `_migrations` - service_role only
- `booking_assignment_attempts` - service_role + authenticated (via booking → restaurant)
- `booking_occasions_audit` - service_role only
- `booking_state_history` - service_role + authenticated (via booking → restaurant)
- `manual_assignment_sessions` - service_role only
- `observability_events` - service_role only
- `table_merge_graph` - service_role + authenticated (via restaurant membership)

### Section 5: RLS Performance Optimization

**Addresses**: `auth_rls_initplan` warning (~30 policies)  
**Risk**: LOW

- Wraps `auth.uid()` in `(SELECT auth.uid())`
- Ensures single evaluation per query instead of per row
- Updated policies on: demand_profiles, table_scarcity_metrics, user_profiles, profiles, booking_versions, strategic_configs, bookings, customers, booking_table_assignments, restaurant_invites, analytics_events, waiting_list, restaurants, profile_update_requests

### Section 6: Remove Duplicate Policies

**Addresses**: `multiple_permissive_policies` warning (~80 instances)  
**Risk**: LOW

Tables cleaned:

- analytics_events
- booking_versions
- booking_slots
- customer_profiles
- leads
- merge_rules
- profiles
- restaurant_memberships
- strategic_configs
- table_inventory
- user_profiles
- waiting_list

### Section 7: Verification

- Query to check RLS status on all tables
- Query to verify function search paths
- Query to verify extension locations
- Query to confirm audit_logs exists

---

## Execution Instructions

### Prerequisites

1. **Create a backup** before running:
   - Go to Supabase Dashboard → Database → Backups
   - Create a PITR (Point-in-Time Recovery) point

2. **Test in staging first**:
   ```bash
   # Connect to staging
   psql $STAGING_DATABASE_URL -f CONSOLIDATED_DATABASE_FIXES_20251224.sql
   ```

### Running the Migration

1. Open **Supabase SQL Editor**
2. Copy the entire script content
3. Execute in SQL Editor
4. Review the verification output at the end

### Expected Output

```
[SECTION 1] Extensions schema configured ✓
[SECTION 2] 35 functions updated with secure search_path ✓
[SECTION 3] audit_logs table created ✓
[SECTION 4] RLS enabled on unprotected tables ✓
[SECTION 5] RLS policies optimized with (SELECT auth.uid()) ✓
[SECTION 6] Duplicate policies removed ✓
=== MIGRATION COMPLETE ===
```

---

## Rollback Plan

If issues occur, restore from the PITR point created before migration.

For specific rollbacks:

### Rollback Extensions to Public

```sql
DROP EXTENSION IF EXISTS citext CASCADE;
CREATE EXTENSION citext WITH SCHEMA public;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION pgcrypto WITH SCHEMA public;
DROP EXTENSION IF EXISTS btree_gist CASCADE;
CREATE EXTENSION btree_gist WITH SCHEMA public;
ALTER DATABASE postgres SET search_path = public;
```

### Drop audit_logs Table

```sql
DROP TABLE IF EXISTS public.audit_logs CASCADE;
```

---

## Fixes NOT Included (Application Code)

The following fixes are in application code, not database:

1. **Customer Phone Duplicate Handling** (`server/customers.ts`)
   - Phone-based lookup fallback on unique violation

2. **Booking Time Validation** (`server/bookings/pastTimeValidation.ts`)
   - Midnight handling (`24:xx:xx` → next-day `00:xx:xx`)

3. **Guest Booking Access Token** (`server/bookings/access-token.ts`)
   - HMAC-based stateless tokens
   - ID-first booking lookup

4. **Email Link URLs** (`server/emails/bookings.ts`)
   - Correct base URL for manage links

---

## Verification After Migration

Run the Supabase Database Linter:

1. Go to Supabase Dashboard → Database → Linter
2. Click "Run linter"
3. All ERROR and WARNING counts should be reduced

Expected results:

- `rls_disabled_in_public`: 0 errors
- `function_search_path_mutable`: 0 warnings
- `extension_in_public`: 0 warnings
- `auth_rls_initplan`: 0 warnings
- `multiple_permissive_policies`: Significantly reduced

---

## Contact

For issues with this migration, reference the original task folders:

- `/tasks/supabase-security-hardening-20251224-1041/`
- `/tasks/guest-booking-access-revamp-20251224-0124/`
