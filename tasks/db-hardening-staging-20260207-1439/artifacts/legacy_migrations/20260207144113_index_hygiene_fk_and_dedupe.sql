-- Index hygiene: add missing FK indexes and remove redundant / duplicate indexes.
-- Staging-first. For production rollout, schedule in a change window.

SET statement_timeout = '120s';
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
