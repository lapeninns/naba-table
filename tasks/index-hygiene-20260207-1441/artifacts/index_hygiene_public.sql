-- Index hygiene for public schema (FK missing indexes + duplicate/redundant indexes)
-- Target: STAGING (execute there first). SQL is idempotent and production-grade.
--
-- Constraints:
-- - No CONCURRENTLY (repo convention)
-- - Use CREATE INDEX IF NOT EXISTS / DROP INDEX IF EXISTS
-- - Do not drop indexes backing constraints (preflight query included)

-- Fail fast on lock contention instead of waiting indefinitely.
SET lock_timeout = '5s';

-- =====================================================================
-- Preflight: ensure planned DROP INDEX targets do NOT back constraints
-- =====================================================================
-- Expected: 0 rows. If any rows appear, stop and reassess the drop plan.
WITH planned_drops(index_fqname) AS (
  VALUES
    ('public.allowed_capacities_restaurant_idx'::text),
    ('public.idx_audit_logs_entity_id'::text),
    ('public.bai_rest_bk_idx'::text),
    ('public.booking_assignment_idempo_bkid_key_idx'::text),
    ('public.idx_booking_assignment_idempotency_created'::text),
    ('public.booking_confirmation_results_hold_idx'::text),
    ('public.idx_booking_slots_lookup'::text),
    ('public.idx_booking_table_assignments_booking'::text),
    ('public.idx_booking_table_assignments_booking_id'::text),
    ('public.idx_bookings_reference'::text),
    ('public.idx_bookings_restaurant_date_start'::text),
    ('public.idx_customers_email_normalized'::text),
    ('public.idx_customers_phone_normalized'::text),
    ('public.idx_loyalty_points_restaurant_customer'::text),
    ('public.idx_loyalty_programs_restaurant'::text),
    ('public.restaurant_turn_bands_lookup_idx'::text),
    ('public.idx_restaurants_slug'::text),
    ('public.idx_strategic_configs_restaurant'::text),
    ('public.table_hold_members_table_active_idx'::text),
    ('public.table_hold_members_table_idx'::text),
    ('public.thm_unique'::text),
    ('public.idx_table_scarcity_metrics_restaurant_type'::text)
),
resolved AS (
  SELECT
    pd.index_fqname,
    to_regclass(pd.index_fqname) AS index_regclass
  FROM planned_drops pd
)
SELECT
  r.index_fqname,
  c.conname AS constraint_name,
  c.contype AS constraint_type
FROM resolved r
JOIN pg_constraint c
  ON c.conindid = r.index_regclass
WHERE r.index_regclass IS NOT NULL
ORDER BY 1;

-- =====================================================================
-- Step 1: Add missing FK prefix indexes (from fk_missing_indexes_public.csv)
-- =====================================================================

CREATE INDEX IF NOT EXISTS allocations_created_by_idx
  ON public.allocations (created_by);

CREATE INDEX IF NOT EXISTS booking_assignment_idempotency_merge_group_allocation_id_idx
  ON public.booking_assignment_idempotency (merge_group_allocation_id);

CREATE INDEX IF NOT EXISTS booking_confirmation_results_restaurant_id_idx
  ON public.booking_confirmation_results (restaurant_id);

CREATE INDEX IF NOT EXISTS booking_state_history_changed_by_idx
  ON public.booking_state_history (changed_by);

CREATE INDEX IF NOT EXISTS booking_table_assignments_allocation_id_idx
  ON public.booking_table_assignments (allocation_id);

CREATE INDEX IF NOT EXISTS booking_table_assignments_assigned_by_idx
  ON public.booking_table_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS bookings_assigned_zone_id_idx
  ON public.bookings (assigned_zone_id);

CREATE INDEX IF NOT EXISTS bookings_booking_type_idx
  ON public.bookings (booking_type);

CREATE INDEX IF NOT EXISTS loyalty_point_events_restaurant_id_idx
  ON public.loyalty_point_events (restaurant_id);

CREATE INDEX IF NOT EXISTS loyalty_points_customer_id_idx
  ON public.loyalty_points (customer_id);

CREATE INDEX IF NOT EXISTS manual_assignment_sessions_created_by_idx
  ON public.manual_assignment_sessions (created_by);

CREATE INDEX IF NOT EXISTS manual_assignment_sessions_hold_id_idx
  ON public.manual_assignment_sessions (hold_id);

CREATE INDEX IF NOT EXISTS restaurant_capacity_rules_service_period_id_idx
  ON public.restaurant_capacity_rules (service_period_id);

CREATE INDEX IF NOT EXISTS restaurant_invites_invited_by_idx
  ON public.restaurant_invites (invited_by);

CREATE INDEX IF NOT EXISTS restaurant_service_periods_booking_option_idx
  ON public.restaurant_service_periods (booking_option);

-- FK is on (booking_option). Existing composite indexes starting with restaurant_id do NOT support FK checks.
CREATE INDEX IF NOT EXISTS restaurant_turn_bands_booking_option_idx
  ON public.restaurant_turn_bands (booking_option);

CREATE INDEX IF NOT EXISTS strategic_configs_updated_by_idx
  ON public.strategic_configs (updated_by);

CREATE INDEX IF NOT EXISTS table_holds_created_by_idx
  ON public.table_holds (created_by);

CREATE INDEX IF NOT EXISTS table_inventory_restaurant_id_capacity_idx
  ON public.table_inventory (restaurant_id, capacity);

-- =====================================================================
-- Step 2: Drop redundant/duplicate indexes
-- Source: index_duplicates_public.csv + index_duplicates_ignoring_uniqueness_public.csv
-- Keep rules:
-- - Keep PK/UNIQUE-backed indexes where present; drop redundant non-unique.
-- - For non-unique duplicates, keep one representative and drop the others.
-- =====================================================================

-- allowed_capacities: redundant with allowed_capacities_pkey (restaurant_id, capacity)
DROP INDEX IF EXISTS public.allowed_capacities_restaurant_idx;

-- audit_logs: keep idx_audit_logs_entity, drop duplicate
DROP INDEX IF EXISTS public.idx_audit_logs_entity_id;

-- booking_assignment_idempotency: keep booking_assignment_idempotency_pkey, drop redundant non-unique duplicates
DROP INDEX IF EXISTS public.bai_rest_bk_idx;
DROP INDEX IF EXISTS public.booking_assignment_idempo_bkid_key_idx;

-- booking_assignment_idempotency: created_at DESC exact duplicate pair; keep booking_assignment_idempotency_created_idx, drop the other
DROP INDEX IF EXISTS public.idx_booking_assignment_idempotency_created;

-- booking_confirmation_results: redundant with UNIQUE(hold_id)
DROP INDEX IF EXISTS public.booking_confirmation_results_hold_idx;

-- booking_slots: redundant with UNIQUE(restaurant_id, slot_date, slot_time)
DROP INDEX IF EXISTS public.idx_booking_slots_lookup;

-- booking_table_assignments: keep bta_booking_id_idx, drop duplicates
DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking;
DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking_id;

-- bookings: redundant with UNIQUE(reference)
DROP INDEX IF EXISTS public.idx_bookings_reference;

-- bookings: keep bookings_restaurant_date_idx, drop duplicate
DROP INDEX IF EXISTS public.idx_bookings_restaurant_date_start;

-- customers: redundant with UNIQUE(restaurant_id, email_normalized)
DROP INDEX IF EXISTS public.idx_customers_email_normalized;

-- customers: redundant with UNIQUE(restaurant_id, phone_normalized)
DROP INDEX IF EXISTS public.idx_customers_phone_normalized;

-- loyalty_points: redundant with UNIQUE(restaurant_id, customer_id)
DROP INDEX IF EXISTS public.idx_loyalty_points_restaurant_customer;

-- loyalty_programs: redundant with UNIQUE(restaurant_id)
DROP INDEX IF EXISTS public.idx_loyalty_programs_restaurant;

-- restaurant_turn_bands: keep restaurant_turn_bands_unique_idx, drop redundant non-unique duplicate
DROP INDEX IF EXISTS public.restaurant_turn_bands_lookup_idx;

-- restaurants: redundant with UNIQUE(slug)
DROP INDEX IF EXISTS public.idx_restaurants_slug;

-- strategic_configs: redundant with UNIQUE(restaurant_id)
DROP INDEX IF EXISTS public.idx_strategic_configs_restaurant;

-- table_hold_members: keep constraint-backed unique index, drop redundant unique index
DROP INDEX IF EXISTS public.thm_unique;

-- table_hold_members: keep idx_table_hold_members_table, drop duplicates
DROP INDEX IF EXISTS public.table_hold_members_table_active_idx;
DROP INDEX IF EXISTS public.table_hold_members_table_idx;

-- table_scarcity_metrics: redundant with UNIQUE(restaurant_id, table_type)
DROP INDEX IF EXISTS public.idx_table_scarcity_metrics_restaurant_type;

-- =====================================================================
-- Verification: Missing FK supporting indexes should be 0
-- =====================================================================

-- 1) Count missing FK prefix indexes in public
WITH fk AS (
  SELECT
    con.oid,
    con.conname AS fk_name,
    con.conrelid,
    con.conrelid::regclass::text AS table_fqname,
    con.conkey
  FROM pg_constraint con
  JOIN pg_namespace ns ON ns.oid = con.connamespace
  WHERE con.contype = 'f'
    AND ns.nspname = 'public'
),
missing AS (
  SELECT fk.*
  FROM fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = fk.conrelid
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(fk.conkey, 1)] = fk.conkey
  )
)
SELECT count(*) AS missing_fk_index_count
FROM missing;

-- 2) Detailed list (should return 0 rows)
WITH fk AS (
  SELECT
    con.conname AS fk_name,
    ns.nspname AS schema,
    tbl.relname AS table_name,
    con.conrelid,
    con.conkey,
    array_agg(att.attname ORDER BY ord.ordinality) AS fk_columns
  FROM pg_constraint con
  JOIN pg_namespace ns ON ns.oid = con.connamespace
  JOIN pg_class tbl ON tbl.oid = con.conrelid
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ord(attnum, ordinality) ON true
  JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
  WHERE con.contype = 'f'
    AND ns.nspname = 'public'
  GROUP BY con.conname, ns.nspname, tbl.relname, con.conrelid, con.conkey
),
missing AS (
  SELECT fk.*
  FROM fk
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indrelid = fk.conrelid
      AND i.indisvalid
      AND i.indisready
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:array_length(fk.conkey, 1)] = fk.conkey
  )
)
SELECT
  schema,
  table_name,
  fk_name,
  fk_columns
FROM missing
ORDER BY schema, table_name, fk_name;

-- =====================================================================
-- Verification: Duplicate indexes should be 0 groups
-- =====================================================================

-- A) Exact duplicates (including uniqueness): should return 0 rows
WITH idx AS (
  SELECT
    ns.nspname AS schema,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    am.amname AS access_method,
    i.indisunique,
    i.indisprimary,
    string_to_array(i.indkey::text, ' ')::int2[] AS indkey,
    i.indclass,
    i.indcollation,
    i.indoption,
    i.indpred,
    i.indexprs
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  JOIN pg_am am ON am.oid = ic.relam
  WHERE ns.nspname = 'public'
    AND tbl.relkind = 'r'
    AND ic.relkind = 'i'
),
dupes AS (
  SELECT
    schema,
    table_name,
    array_agg(index_name ORDER BY index_name) AS duplicate_index_names,
    max(pg_get_indexdef(to_regclass(format('%I.%I', schema, index_name)))) AS sample_index_def,
    count(*) AS index_count
  FROM idx
  GROUP BY
    schema,
    table_name,
    access_method,
    indisunique,
    indisprimary,
    indkey,
    indclass,
    indcollation,
    indoption,
    indpred,
    indexprs
  HAVING count(*) > 1
)
SELECT *
FROM dupes
ORDER BY schema, table_name;

-- B) Duplicates ignoring uniqueness: should return 0 rows
WITH idx AS (
  SELECT
    ns.nspname AS schema,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    am.amname AS access_method,
    i.indisunique,
    i.indisprimary,
    string_to_array(i.indkey::text, ' ')::int2[] AS indkey,
    i.indclass,
    i.indcollation,
    i.indoption,
    i.indpred,
    i.indexprs
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  JOIN pg_am am ON am.oid = ic.relam
  WHERE ns.nspname = 'public'
    AND tbl.relkind = 'r'
    AND ic.relkind = 'i'
),
dupes AS (
  SELECT
    schema,
    table_name,
    array_agg(index_name ORDER BY index_name) AS index_names,
    array_agg(indisunique ORDER BY index_name) AS index_unique_flags,
    array_agg(indisprimary ORDER BY index_name) AS index_primary_flags,
    count(*) AS index_count
  FROM idx
  GROUP BY
    schema,
    table_name,
    access_method,
    indkey,
    indclass,
    indcollation,
    indoption,
    indpred,
    indexprs
  HAVING count(*) > 1
)
SELECT *
FROM dupes
ORDER BY schema, table_name;
