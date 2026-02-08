-- Staging-first hardening for internal tables.
-- Goal: remove unsafe RLS policies (`TO public` with `ALL` + `qual=true`) and tighten privileges.
--
-- Notes:
-- - Supabase commonly grants `anon`/`authenticated` broadly and relies on RLS. For internal tables,
--   we add defense-in-depth by revoking table privileges from those roles.
-- - Policies are table-scoped; names can repeat across tables safely.

-- Keep conservative timeouts for fast DDL (policies/grants).
SET statement_timeout = '120s';
SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- audit_logs: internal-only (service role)
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;

-- Defense-in-depth: do not allow direct client access even if RLS is misconfigured later.
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;

-- `service_role_all` already exists on this table (kept).

-- ---------------------------------------------------------------------------
-- booking_assignment_idempotency: internal-only (service role)
-- ---------------------------------------------------------------------------

ALTER TABLE public.booking_assignment_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignment_idempotency FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to booking_assignment_idempotency"
  ON public.booking_assignment_idempotency;

REVOKE ALL ON TABLE public.booking_assignment_idempotency FROM anon, authenticated;

-- `service_role_all` already exists on this table (kept).

-- ---------------------------------------------------------------------------
-- feature_flag_overrides: internal-only (service role)
-- ---------------------------------------------------------------------------

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to feature_flag_overrides" ON public.feature_flag_overrides;
DROP POLICY IF EXISTS service_role_all ON public.feature_flag_overrides;

CREATE POLICY service_role_all ON public.feature_flag_overrides
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.feature_flag_overrides FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- table_hold_windows: internal-only (service role)
-- ---------------------------------------------------------------------------

ALTER TABLE public.table_hold_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_hold_windows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to table_hold_windows" ON public.table_hold_windows;
DROP POLICY IF EXISTS service_role_all ON public.table_hold_windows;

CREATE POLICY service_role_all ON public.table_hold_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.table_hold_windows FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20260207144113_index_hygiene_fk_and_dedupe.sql
-- ---------------------------------------------------------------------------

-- Index hygiene: add missing FK indexes and remove redundant / duplicate indexes.
-- Staging-first. For production rollout, schedule in a change window.

-- Index builds/drops can take longer on production datasets.
--
-- Note: Supabase CLI `db push` uses pipelined execution and does not support
-- `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` (Postgres raises
-- `cannot be executed within a pipeline`). For migrations applied via the CLI,
-- use non-CONCURRENTLY DDL and schedule a change window for production.
SET statement_timeout = '15min';
SET lock_timeout = '5s';

-- ---------------------------------------------------------------------------
-- 1) Add missing FK indexes (btree)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_allocations_created_by
  ON public.allocations (created_by);

CREATE INDEX IF NOT EXISTS idx_booking_assignment_idempotency_merge_group_allocation_id
  ON public.booking_assignment_idempotency (merge_group_allocation_id);

CREATE INDEX IF NOT EXISTS idx_booking_confirmation_results_restaurant_id
  ON public.booking_confirmation_results (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_booking_state_history_changed_by
  ON public.booking_state_history (changed_by);

CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_allocation_id
  ON public.booking_table_assignments (allocation_id);

CREATE INDEX IF NOT EXISTS idx_booking_table_assignments_assigned_by
  ON public.booking_table_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_bookings_assigned_zone_id
  ON public.bookings (assigned_zone_id);

CREATE INDEX IF NOT EXISTS idx_bookings_booking_type
  ON public.bookings (booking_type);

CREATE INDEX IF NOT EXISTS idx_manual_assignment_sessions_created_by
  ON public.manual_assignment_sessions (created_by);

CREATE INDEX IF NOT EXISTS idx_manual_assignment_sessions_hold_id
  ON public.manual_assignment_sessions (hold_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_service_period_id
  ON public.restaurant_capacity_rules (service_period_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_invites_invited_by
  ON public.restaurant_invites (invited_by);

CREATE INDEX IF NOT EXISTS idx_restaurant_service_periods_booking_option
  ON public.restaurant_service_periods (booking_option);

CREATE INDEX IF NOT EXISTS idx_restaurant_turn_bands_booking_option
  ON public.restaurant_turn_bands (booking_option);

CREATE INDEX IF NOT EXISTS idx_strategic_configs_updated_by
  ON public.strategic_configs (updated_by);

CREATE INDEX IF NOT EXISTS idx_table_holds_created_by
  ON public.table_holds (created_by);

CREATE INDEX IF NOT EXISTS idx_table_inventory_allowed_capacity
  ON public.table_inventory (restaurant_id, capacity);

-- ---------------------------------------------------------------------------
-- 2) Drop duplicate / redundant indexes
-- ---------------------------------------------------------------------------

-- allowed_capacities: redundant with PK (unique index)
DROP INDEX IF EXISTS public.allowed_capacities_restaurant_idx;

-- audit_logs: exact duplicate definitions
DROP INDEX IF EXISTS public.idx_audit_logs_entity_id;

-- booking_assignment_idempotency: duplicates covered by PK + redundant directional/covering indexes
DROP INDEX IF EXISTS public.bai_rest_bk_idx;
DROP INDEX IF EXISTS public.booking_assignment_idempo_bkid_key_idx;
DROP INDEX IF EXISTS public.idx_booking_assignment_idempotency_booking; -- PK prefix covers booking_id
DROP INDEX IF EXISTS public.idx_booking_assignment_idempotency_created; -- keep DESC index

-- booking_confirmation_results: redundant with unique index
DROP INDEX IF EXISTS public.booking_confirmation_results_hold_idx;

-- booking_slots: redundant with unique index on same columns
DROP INDEX IF EXISTS public.idx_booking_slots_lookup;

-- booking_table_assignments: redundant indexes on booking_id (unique (booking_id, table_id) covers)
DROP INDEX IF EXISTS public.bta_booking_id_idx;
DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking;
DROP INDEX IF EXISTS public.idx_booking_table_assignments_booking_id;

-- bookings: redundant with unique index, and duplicate date-start index
DROP INDEX IF EXISTS public.idx_bookings_reference;
DROP INDEX IF EXISTS public.bookings_restaurant_date_idx; -- keep idx_bookings_restaurant_date_start

-- customers: redundant with unique constraints
DROP INDEX IF EXISTS public.idx_customers_email_normalized;
DROP INDEX IF EXISTS public.idx_customers_phone_normalized;

-- restaurant_turn_bands: redundant with unique index
DROP INDEX IF EXISTS public.restaurant_turn_bands_lookup_idx;

-- restaurants: redundant with unique constraint
DROP INDEX IF EXISTS public.idx_restaurants_slug;

-- strategic_configs: redundant with unique constraint
DROP INDEX IF EXISTS public.idx_strategic_configs_restaurant;

-- table_hold_members: redundant duplicate unique and duplicate table_id indexes
DROP INDEX IF EXISTS public.thm_unique;
DROP INDEX IF EXISTS public.idx_table_hold_members_hold; -- unique (hold_id, table_id) covers hold_id
DROP INDEX IF EXISTS public.table_hold_members_table_active_idx;
DROP INDEX IF EXISTS public.table_hold_members_table_idx;

-- table_scarcity_metrics: redundant with unique index
DROP INDEX IF EXISTS public.idx_table_scarcity_metrics_restaurant_type;


-- ---------------------------------------------------------------------------
-- MERGED FROM: 20260207144113_remove_loyalty_feature.sql
-- ---------------------------------------------------------------------------

-- Remove loyalty feature fully. Product confirmed loyalty is permanently deprecated.
-- Staging-first: apply on staging, verify, then follow up with a production rollout task.

SET statement_timeout = '120s';
SET lock_timeout = '5s';

-- Defense-in-depth (if this migration is partially applied / retried).
REVOKE ALL ON TABLE public.loyalty_point_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_points FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_programs FROM anon, authenticated;

-- Drop tables (also drops their indexes, policies, triggers, and composite types).
DROP TABLE IF EXISTS public.loyalty_point_events CASCADE;
DROP TABLE IF EXISTS public.loyalty_points CASCADE;
DROP TABLE IF EXISTS public.loyalty_programs CASCADE;

-- Drop enum type once tables are gone.
DROP TYPE IF EXISTS public.loyalty_tier CASCADE;
