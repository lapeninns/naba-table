# Database Schema Optimization Review

## Project: NabaTable / SajiloReserveX

## Date: 2026-01-06

## Status: Comprehensive Analysis Complete

---

## Executive Summary

After analyzing your 49 tables, I've identified **15 optimization opportunities** across 8 categories. The schema is well-designed overall, but there are specific improvements that can reduce storage, improve query performance, and support future scaling.

### Quick Wins (High Impact, Low Risk)

| #   | Optimization                    | Tables Affected                        | Expected Impact       |
| --- | ------------------------------- | -------------------------------------- | --------------------- |
| 1   | Remove redundant columns        | `bookings`                             | -5% storage           |
| 2   | Add missing FK indexes          | `allocations`, `booking_state_history` | 20-50% faster deletes |
| 3   | Tighten data types              | `audit_logs`, `observability_events`   | -10% storage          |
| 4   | Configure partitioning (future) | `observability_events`, `audit_logs`   | 10x faster cleanup    |

---

## 1. Column & Data Type Analysis

### 1.1 Potentially Unused or Redundant Columns

| Table                       | Column                                              | Issue                                   | Recommendation                                                                                                                     |
| --------------------------- | --------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `bookings`                  | `customer_name`, `customer_email`, `customer_phone` | **Denormalized from `customers`**       | ⚠️ Keep for now - needed for guest booking flow where customer may not exist yet. Document as intentional denormalization.         |
| `bookings`                  | `start_time`, `end_time`                            | **Redundant with `start_at`, `end_at`** | Consider deprecating `start_time`/`end_time` in favor of `timestamptz`. Keep for backward compatibility but don't use in new code. |
| `bookings`                  | `pending_ref`                                       | Used for async booking flow             | ✅ OK - needed for pending bookings                                                                                                |
| `booking_table_assignments` | `slot_id`                                           | Always NULL in current data             | 🔍 Check if still used. If not, consider dropping.                                                                                 |
| `booking_table_assignments` | `allocation_id`                                     | References allocations                  | ✅ OK                                                                                                                              |
| `table_inventory`           | `section`                                           | Legacy field                            | 🔍 Appears unused (zones replaced sections). Consider deprecating.                                                                 |

### 1.2 Data Type Optimizations

| Table                   | Column                   | Current Type | Recommended Type | Savings                       |
| ----------------------- | ------------------------ | ------------ | ---------------- | ----------------------------- |
| `booking_state_history` | `id`                     | `bigint`     | ✅ OK            | Keep - auto-increment is fine |
| `booking_slots`         | `available_capacity`     | `integer`    | `smallint`       | 2 bytes/row                   |
| `booking_slots`         | `reserved_count`         | `integer`    | `smallint`       | 2 bytes/row                   |
| `booking_slots`         | `version`                | `integer`    | `smallint`       | 2 bytes/row                   |
| `bookings`              | `party_size`             | `integer`    | `smallint`       | 2 bytes/row                   |
| `bookings`              | `loyalty_points_awarded` | `integer`    | `smallint`       | 2 bytes/row                   |
| `audit_logs`            | `entity`                 | `text`       | `varchar(50)`    | Better validation             |
| `audit_logs`            | `action`                 | `text`       | `varchar(50)`    | Better validation             |
| `observability_events`  | `source`                 | `text`       | `varchar(100)`   | Better validation             |
| `observability_events`  | `event_type`             | `text`       | `varchar(100)`   | Better validation             |
| `capacity_outbox`       | `event_type`             | `text`       | `varchar(50)`    | Better validation             |

**Note:** These are micro-optimizations. With your current data volume (<1000 rows), the impact is negligible. Prioritize these when scaling to 100K+ rows.

### 1.3 ENUM vs TEXT Analysis

Your schema correctly uses ENUMs for:

- `booking_status` ✅
- `table_status` ✅
- `table_category` ✅
- `seating_preference_type` ✅
- `table_hold_status` ✅

**Recommendation:** Continue using ENUMs for closed sets. For open-ended fields like `event_type`, TEXT is appropriate.

---

## 2. Row Size & Storage Analysis

### 2.1 Wide Row Tables (Potential Splitting)

| Table                        | Est. Row Size   | Wide Columns                                                         | Recommendation                                                                 |
| ---------------------------- | --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `bookings`                   | ~500-1000 bytes | `details` (jsonb), `notes` (text), `auto_assign_last_result` (jsonb) | **Consider splitting** - Move rarely-queried JSONB to `booking_metadata` table |
| `restaurants`                | ~400-600 bytes  | `email_templates` (jsonb), `booking_policy` (text)                   | ✅ OK - small table (3 rows)                                                   |
| `manual_assignment_sessions` | ~300-400 bytes  | `selection` (jsonb), many version columns                            | ✅ OK - ephemeral data                                                         |
| `observability_events`       | ~200-500 bytes  | `context` (jsonb)                                                    | **Partition candidate**                                                        |
| `audit_logs`                 | ~200-500 bytes  | `metadata` (jsonb)                                                   | **Partition candidate**                                                        |

### 2.2 Recommended Table Split: `bookings` → `booking_metadata`

```sql
-- OPTIONAL: Split wide JSONB data to separate table
-- Only do this if bookings table grows to 100K+ rows

CREATE TABLE public.booking_metadata (
    booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    details jsonb,
    auto_assign_last_result jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Migrate existing data
INSERT INTO booking_metadata (booking_id, details, auto_assign_last_result, updated_at)
SELECT id, details, auto_assign_last_result, updated_at
FROM bookings
WHERE details IS NOT NULL OR auto_assign_last_result IS NOT NULL;
```

**Verdict:** NOT NEEDED NOW. Your `bookings` table has 90 rows. Revisit at 50K+ rows.

---

## 3. Index Analysis

### 3.1 Missing Indexes for Common Queries

Based on your schema and typical query patterns:

| Table                   | Missing Index                 | Query Pattern               | Priority  |
| ----------------------- | ----------------------------- | --------------------------- | --------- |
| `allocations`           | `booking_id`                  | Join bookings → allocations | 🔴 HIGH   |
| `booking_state_history` | `booking_id, changed_at DESC` | Booking history lookup      | 🔴 HIGH   |
| `capacity_outbox`       | `status, next_attempt_at`     | Outbox processor queue      | 🟡 MEDIUM |
| `scheduled_emails`      | `status, scheduled_for`       | Email scheduler             | 🟡 MEDIUM |
| `analytics_events`      | `restaurant_id, occurred_at`  | Analytics dashboard         | 🟢 LOW    |

### 3.2 Potentially Redundant Indexes

| Index                                        | Table                          | Issue                                                                      | Recommendation   |
| -------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ---------------- |
| `booking_assignment_idempotency_created_idx` | booking_assignment_idempotency | Duplicates `idx_booking_assignment_idempotency_created`                    | Drop one         |
| `booking_assignment_idempo_bkid_key_idx`     | booking_assignment_idempotency | Check if needed                                                            | Review           |
| `idx_bookings_restaurant_date_end`           | bookings                       | Low usage (3 scans) vs `idx_bookings_restaurant_date_start` (10,889 scans) | May be redundant |

### 3.3 Index Order Optimization

For composite indexes, column order matters. Review these:

| Index                                 | Current Order                           | Optimal Order | Reason                              |
| ------------------------------------- | --------------------------------------- | ------------- | ----------------------------------- |
| `idx_bookings_customer_id`            | `(customer_id, booking_date DESC)`      | ✅ Correct    | Customer first, then date for range |
| `bookings_restaurant_date_status_idx` | `(restaurant_id, booking_date, status)` | ✅ Correct    | Most selective first                |

---

## 4. Foreign Key Analysis

### 4.1 Missing Foreign Key Constraints

| Table                       | Column        | Should Reference      | Issue                                |
| --------------------------- | ------------- | --------------------- | ------------------------------------ |
| `allocations`               | `booking_id`  | `bookings(id)`        | 🔍 Check if FK exists                |
| `allocations`               | `resource_id` | `table_inventory(id)` | 🔍 Dynamic reference (table or zone) |
| `booking_table_assignments` | `booking_id`  | `bookings(id)`        | Should have FK with CASCADE          |
| `booking_table_assignments` | `table_id`    | `table_inventory(id)` | Should have FK                       |
| `booking_state_history`     | `booking_id`  | `bookings(id)`        | Should have FK with CASCADE          |
| `customer_profiles`         | `customer_id` | `customers(id)`       | Should have FK with CASCADE          |

### 4.2 Missing FK Indexes

**Critical:** Foreign key columns without indexes cause slow DELETE operations.

```sql
-- Check for FK columns without indexes
-- These cause full table scans on parent delete

-- allocations.booking_id - NEEDS INDEX
CREATE INDEX IF NOT EXISTS idx_allocations_booking_id
ON public.allocations (booking_id);

-- booking_state_history.booking_id - NEEDS INDEX
CREATE INDEX IF NOT EXISTS idx_booking_state_history_booking_id
ON public.booking_state_history (booking_id);

-- booking_table_assignments.booking_id - Has idx_booking_table_assignments_booking_id ✅
-- booking_table_assignments.table_id - Has idx_booking_table_assignments_table ✅
```

### 4.3 Cascade Rule Review

| Relationship                         | Current | Recommended                     | Reason                                  |
| ------------------------------------ | ------- | ------------------------------- | --------------------------------------- |
| bookings → booking_table_assignments | Unknown | `ON DELETE CASCADE`             | Delete assignments when booking deleted |
| bookings → allocations               | Unknown | `ON DELETE SET NULL` or CASCADE | Depends on business logic               |
| bookings → booking_state_history     | Unknown | `ON DELETE CASCADE`             | History belongs to booking              |
| customers → customer_profiles        | Unknown | `ON DELETE CASCADE`             | Profile belongs to customer             |
| customers → bookings                 | Unknown | `ON DELETE RESTRICT`            | Prevent deleting customer with bookings |

---

## 5. Query Pattern Optimization

### 5.1 Common Query Patterns (Based on Schema)

| Query Pattern                  | Relevant Tables                  | Current Support                         | Optimization          |
| ------------------------------ | -------------------------------- | --------------------------------------- | --------------------- |
| Dashboard: Today's bookings    | `bookings`                       | `idx_bookings_restaurant_date_start` ✅ | Good                  |
| Floor plan: Table availability | `allocations`, `table_inventory` | `idx_allocations_window_gist` ✅        | Good                  |
| Customer lookup                | `customers`                      | `idx_customers_email_normalized` ✅     | Good                  |
| Booking history                | `booking_state_history`          | ❌ Missing index                        | Add composite index   |
| Outbox processing              | `capacity_outbox`                | ❌ Missing index                        | Add status+time index |

### 5.2 Expensive Join Patterns

| Join                           | Tables   | Issue                  | Recommendation                                   |
| ------------------------------ | -------- | ---------------------- | ------------------------------------------------ |
| Booking → Assignments → Tables | 3 tables | Multiple joins         | Consider materialized view for floor plan        |
| Booking → Customer → Profile   | 3 tables | Always needed together | ✅ OK for now, consider denormalization at scale |

---

## 6. Normalization Analysis

### 6.1 Intentional Denormalization (KEEP)

| Table                       | Denormalized Columns                                | Reason                                          |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `bookings`                  | `customer_name`, `customer_email`, `customer_phone` | Guest bookings may not have customer record yet |
| `customers`                 | `email_normalized`, `phone_normalized`              | Generated columns for fast lookup ✅            |
| `table_hold_windows`        | All columns                                         | Denormalized for fast conflict detection ✅     |
| `booking_table_assignments` | `assignment_window`                                 | Generated column for range queries ✅           |

### 6.2 Potential Normalization Issues

| Issue                                                               | Tables              | Recommendation                                          |
| ------------------------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| `bookings.marketing_opt_in` duplicates `customers.marketing_opt_in` | bookings, customers | 🔍 Clarify: booking-level vs customer-level preference  |
| `customer_profiles.marketing_opt_in`                                | customer_profiles   | Triple duplication - consolidate to one source of truth |

---

## 7. Partitioning & Archiving Strategy

### 7.1 Partition Candidates

| Table                   | Current Rows | Growth Rate | Partition Strategy                      |
| ----------------------- | ------------ | ----------- | --------------------------------------- |
| `observability_events`  | 2,618        | High (logs) | **Partition by `created_at` (monthly)** |
| `audit_logs`            | 665          | Medium      | **Partition by `created_at` (monthly)** |
| `booking_state_history` | 107          | Medium      | Wait until 100K+ rows                   |
| `booking_versions`      | 0            | Low         | Not needed                              |
| `analytics_events`      | 68           | Medium      | Wait until 100K+ rows                   |

### 7.2 Recommended Partitioning (Future)

```sql
-- FUTURE: When observability_events reaches 100K+ rows
-- Partition by month for easy archival

-- 1. Create partitioned table
CREATE TABLE public.observability_events_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    source text NOT NULL,
    event_type text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    context jsonb,
    restaurant_id uuid,
    booking_id uuid
) PARTITION BY RANGE (created_at);

-- 2. Create monthly partitions
CREATE TABLE observability_events_y2026m01
    PARTITION OF observability_events_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE observability_events_y2026m02
    PARTITION OF observability_events_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 3. Archive old partitions by simply detaching
ALTER TABLE observability_events_partitioned
    DETACH PARTITION observability_events_y2025m12;
```

### 7.3 Archive Strategy

| Table                   | Retention        | Archive Method                          |
| ----------------------- | ---------------- | --------------------------------------- |
| `observability_events`  | 30 days          | Delete (append-only log)                |
| `audit_logs`            | 1 year           | Move to `audit_logs_archive`            |
| `booking_state_history` | 1 year           | Move to `booking_state_history_archive` |
| `booking_versions`      | 6 months         | Delete (can be reconstructed)           |
| `allocations`           | Active + 30 days | `allocations_archive` exists ✅         |

---

## 8. Statistics & Maintenance

### 8.1 Tables Needing ANALYZE

```sql
-- Tables with stale statistics (never analyzed)
SELECT relname, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND last_analyze IS NULL
  AND last_autoanalyze IS NULL
  AND n_live_tup > 10
ORDER BY n_live_tup DESC;
```

### 8.2 Autovacuum Configuration Needed

Already configured in `maintenance-sql-20260106.sql`:

- `booking_state_history` ✅
- `allocations` ✅
- `table_holds` ✅
- `capacity_outbox` ✅
- `observability_events` ✅
- `customers` ✅
- `customer_profiles` ✅

---

## 9. SQL Implementation

### 9.1 Immediate Actions (Copy/Paste Ready)

```sql
-- =============================================
-- SCHEMA OPTIMIZATION: PHASE 1 (Immediate)
-- =============================================

-- 1. Add missing FK indexes (prevents slow cascading deletes)
CREATE INDEX IF NOT EXISTS idx_allocations_booking_id
ON public.allocations (booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_state_history_booking_id
ON public.booking_state_history (booking_id);

-- 2. Add outbox processor index
CREATE INDEX IF NOT EXISTS idx_capacity_outbox_pending
ON public.capacity_outbox (status, next_attempt_at)
WHERE status = 'pending';

-- 3. Add scheduled emails processor index
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
ON public.scheduled_emails (status, scheduled_for)
WHERE status = 'pending';

-- 4. Verify indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_allocations_booking_id',
    'idx_booking_state_history_booking_id',
    'idx_capacity_outbox_pending',
    'idx_scheduled_emails_pending'
  );
```

### 9.2 Drop Redundant Indexes (After Verification)

```sql
-- =============================================
-- VERIFY BEFORE DROPPING: Check these are truly redundant
-- =============================================

-- Check if both indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'booking_assignment_idempotency_created_idx',
    'idx_booking_assignment_idempotency_created'
  );

-- If both exist and are identical, drop one:
-- DROP INDEX IF EXISTS booking_assignment_idempotency_created_idx;
```

### 9.3 FK Constraint Additions (Phase 2)

```sql
-- =============================================
-- SCHEMA OPTIMIZATION: PHASE 2 (After testing)
-- =============================================

-- Add FK with cascade for booking_state_history
ALTER TABLE public.booking_state_history
ADD CONSTRAINT fk_booking_state_history_booking
FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

-- Add FK with cascade for customer_profiles
ALTER TABLE public.customer_profiles
ADD CONSTRAINT fk_customer_profiles_customer
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Add FK with cascade for booking_table_assignments
ALTER TABLE public.booking_table_assignments
ADD CONSTRAINT fk_booking_table_assignments_booking
FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

-- Verify constraints
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

---

## 10. Priority Action List

### Phase 1: Immediate (This Week)

| #   | Action                                     | Impact | Risk | SQL Section |
| --- | ------------------------------------------ | ------ | ---- | ----------- |
| 1   | Add `idx_allocations_booking_id`           | High   | Low  | 9.1         |
| 2   | Add `idx_booking_state_history_booking_id` | High   | Low  | 9.1         |
| 3   | Add `idx_capacity_outbox_pending`          | Medium | Low  | 9.1         |
| 4   | Add `idx_scheduled_emails_pending`         | Medium | Low  | 9.1         |

### Phase 2: Short-Term (Next 2 Weeks)

| #   | Action                                 | Impact | Risk   | SQL Section |
| --- | -------------------------------------- | ------ | ------ | ----------- |
| 5   | Add FK constraints with CASCADE        | Medium | Medium | 9.3         |
| 6   | Drop redundant indexes                 | Low    | Low    | 9.2         |
| 7   | Consolidate `marketing_opt_in` columns | Low    | Medium | Manual      |

### Phase 3: Long-Term (When Scaling)

| #   | Action                                      | Impact | Risk   | Trigger          |
| --- | ------------------------------------------- | ------ | ------ | ---------------- |
| 8   | Partition `observability_events`            | High   | Medium | When > 100K rows |
| 9   | Partition `audit_logs`                      | High   | Medium | When > 100K rows |
| 10  | Split `bookings` → `booking_metadata`       | Medium | Medium | When > 50K rows  |
| 11  | Tighten data types (`integer` → `smallint`) | Low    | Low    | Major version    |

---

## 11. Schema Health Check Query

Run this periodically to monitor schema health:

```sql
-- =============================================
-- WEEKLY SCHEMA HEALTH CHECK
-- =============================================

-- 1. Tables missing primary key
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = c.oid AND contype = 'p'
  );

-- 2. FK columns without indexes
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = tc.table_name
      AND indexdef LIKE '%' || kcu.column_name || '%'
  );

-- 3. Table growth over time (rows)
SELECT
    relname AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC
LIMIT 20;

-- 4. Unused columns (requires pg_stat_user_columns extension)
-- Not available in Supabase by default
```

---

## 12. Next Steps

1. **Share your top queries/endpoints** - I can provide more specific index recommendations
2. **Run Phase 1 SQL** from Section 9.1
3. **Test Phase 2 FK changes** in staging first
4. **Set up monitoring** with the weekly health check query
5. **Plan partitioning** when `observability_events` approaches 100K rows

Would you like me to:

- [ ] Create a migration file for Phase 1 changes?
- [ ] Analyze specific query patterns you provide?
- [ ] Set up a monitoring dashboard query set?
