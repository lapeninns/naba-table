# Database Optimization Analysis

**Generated:** December 2, 2025  
**Database:** Supabase (PostgreSQL)  
**Project:** mqtchcaavsucsdjskptc

---

## Current State Summary

After cleanup:

- **Total Tables:** 25 (down from ~40)
- **Tables with Data:** 13
- **Total Rows:** 188

---

## ✅ Already Optimized (Good!)

### 1. Indexes - Well Covered

Your database already has comprehensive indexes:

| Table                       | Key Indexes                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `bookings`                  | restaurant_date_status, datetime, customer, reference, status |
| `booking_slots`             | date_range, lookup (restaurant+date+time), service_period     |
| `customers`                 | email_normalized, phone_normalized, restaurant                |
| `table_inventory`           | lookup (restaurant+status+capacity), zone_id                  |
| `booking_table_assignments` | booking_id, table_id, slot_id                                 |

### 2. Triggers - Auto-updating timestamps

All major tables have `updated_at` triggers ✅

### 3. RLS Policies - Security in place

- Staff can only view/edit their restaurant's data
- Service role has full access for backend operations
- Proper auth checks with `user_restaurants()` function

---

## 🔧 Optimization Opportunities

### 1. **Orphaned Triggers & Functions** (CLEANUP)

These triggers/functions reference dropped tables:

```sql
-- Triggers on dropped tables (should be removed)
DROP TRIGGER IF EXISTS update_loyalty_points_updated_at ON loyalty_points;
DROP TRIGGER IF EXISTS update_loyalty_programs_updated_at ON loyalty_programs;
DROP TRIGGER IF EXISTS update_demand_profiles_updated_at ON demand_profiles;
DROP TRIGGER IF EXISTS merge_rules_updated_at ON merge_rules;
DROP TRIGGER IF EXISTS capacity_metrics_hourly_set_updated_at ON capacity_metrics_hourly;
DROP TRIGGER IF EXISTS restaurant_capacity_rules_updated_at ON restaurant_capacity_rules;
DROP TRIGGER IF EXISTS merge_group_members_validate_connectivity ON merge_group_members;
```

### 2. **Orphaned Indexes** (CLEANUP)

Indexes on dropped tables waste space:

```sql
-- Analytics (dropped)
DROP INDEX IF EXISTS idx_analytics_events_booking_id;
DROP INDEX IF EXISTS idx_analytics_events_customer_id;
DROP INDEX IF EXISTS idx_analytics_events_event_type;
DROP INDEX IF EXISTS idx_analytics_events_occurred_at;
DROP INDEX IF EXISTS idx_analytics_events_restaurant_id;
DROP INDEX IF EXISTS idx_analytics_events_restaurant_occurred;

-- Loyalty (dropped)
DROP INDEX IF EXISTS idx_loyalty_point_events_booking;
DROP INDEX IF EXISTS idx_loyalty_point_events_customer;
DROP INDEX IF EXISTS idx_loyalty_points_restaurant_customer;
DROP INDEX IF EXISTS idx_loyalty_programs_restaurant;

-- Capacity metrics (dropped)
DROP INDEX IF EXISTS idx_capacity_metrics_hourly_window;

-- Stripe events (not used)
DROP INDEX IF EXISTS idx_stripe_events_created_at;
DROP INDEX IF EXISTS idx_stripe_events_event_id;
DROP INDEX IF EXISTS idx_stripe_events_event_type;
DROP INDEX IF EXISTS idx_stripe_events_processed;

-- Demand profiles (dropped)
DROP INDEX IF EXISTS idx_demand_profiles_restaurant_day_window;
DROP INDEX IF EXISTS idx_demand_profiles_updated_at;

-- Scarcity metrics (dropped)
DROP INDEX IF EXISTS idx_table_scarcity_metrics_computed_at;
DROP INDEX IF EXISTS idx_table_scarcity_metrics_restaurant_type;
```

### 3. **Orphaned RLS Policies** (CLEANUP)

Policies referencing dropped tables:

```sql
-- Drop orphaned policies
DROP POLICY IF EXISTS "Service role can manage analytics events" ON analytics_events;
DROP POLICY IF EXISTS "Service role can manage loyalty events" ON loyalty_point_events;
DROP POLICY IF EXISTS "Service role can manage loyalty points" ON loyalty_points;
DROP POLICY IF EXISTS "Service role can manage loyalty programs" ON loyalty_programs;
DROP POLICY IF EXISTS "Owners and managers can manage demand profiles" ON demand_profiles;
DROP POLICY IF EXISTS "Owners and managers can manage scarcity metrics" ON table_scarcity_metrics;
```

### 4. **Unused ENUMs** (OPTIONAL CLEANUP)

These ENUMs are for dropped features:

```sql
-- Not critical but could be cleaned
DROP TYPE IF EXISTS analytics_event_type;
DROP TYPE IF EXISTS loyalty_tier;
DROP TYPE IF EXISTS capacity_override_type;
```

---

## 📊 Performance Recommendations

### 1. **Add Missing Indexes** (If needed at scale)

```sql
-- For frequent booking queries by date range
CREATE INDEX IF NOT EXISTS idx_bookings_date_range
ON bookings (restaurant_id, booking_date, start_time, end_time);

-- For customer lookup by profile
CREATE INDEX IF NOT EXISTS idx_customers_user_profile
ON customers (user_profile_id) WHERE user_profile_id IS NOT NULL;
```

### 2. **Vacuum & Analyze** (Run periodically)

```sql
-- Full vacuum to reclaim space (run during low traffic)
VACUUM FULL ANALYZE;

-- Or just analyze to update statistics
ANALYZE;
```

### 3. **Connection Pooling**

Already handled by Supabase ✅

---

## 🧹 Cleanup Script

Run this in Supabase SQL Editor to clean orphaned objects:

```sql
-- ============================================
-- CLEANUP ORPHANED DATABASE OBJECTS
-- ============================================

-- 1. Drop orphaned functions (for dropped tables)
DROP FUNCTION IF EXISTS capacity_metrics_hourly_updated_at() CASCADE;

-- 2. Vacuum to reclaim space
VACUUM ANALYZE;

-- 3. Verify remaining objects
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Summary

| Category           | Status              | Action                 |
| ------------------ | ------------------- | ---------------------- |
| Table Structure    | ✅ Good             | Cleaned                |
| Indexes            | ✅ Good             | Some orphans to remove |
| Triggers           | ⚠️ Has orphans      | Clean up               |
| RLS Policies       | ✅ Good             | Some orphans to remove |
| Data Integrity     | ✅ Good             | -                      |
| Connection Pooling | ✅ Supabase handles | -                      |

**Overall:** Your database is already well-optimized! The main opportunity is cleaning up orphaned objects from dropped tables.
