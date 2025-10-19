-- ============================================================================
-- SUPABASE DATABASE INITIALIZATION
-- ============================================================================
-- Purpose: Single entry point for applying all database schema migrations
-- Usage: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/init-database.sql
-- 
-- This file orchestrates all migrations in the correct order via \ir (include relative).
-- Each migration is executed within its own transaction block for safety.
--
-- Migrations are organized chronologically by timestamp:
-- - 2025-01-01: Remote schema baseline
-- - 2025-01-15: Booking tokens & profiles
-- - 2025-02-04: Auth & memberships
-- - 2025-10-06: Profile update requests
-- - 2025-10-10: Booking options
-- - 2025-10-11: Profile access
-- - 2025-10-16: Capacity engine & booking lifecycle
--
-- ============================================================================

\set ON_ERROR_STOP on

-- Track applied migrations (optional, for audit trail)
CREATE TABLE IF NOT EXISTS _migrations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'applied'
);

-- ============================================================================
-- PHASE 1: BASE SCHEMA (2025-01-01)
-- ============================================================================
-- Baseline schema snapshot from remote Supabase database
\echo '>>> Applying: 20250101000000_remote_schema.sql'
\ir ../migrations/20250101000000_remote_schema.sql
INSERT INTO _migrations (name) VALUES ('20250101000000_remote_schema') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 2: BOOKING & PROFILE ENHANCEMENTS (2025-01-15)
-- ============================================================================
-- Add booking confirmation tokens and profile update policies
\echo '>>> Applying: 20250115071800_add_booking_confirmation_token.sql'
\ir ../migrations/20250115071800_add_booking_confirmation_token.sql
INSERT INTO _migrations (name) VALUES ('20250115071800_add_booking_confirmation_token') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20250115093000_add_profile_update_policies.sql'
\ir ../migrations/20250115093000_add_profile_update_policies.sql
INSERT INTO _migrations (name) VALUES ('20250115093000_add_profile_update_policies') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 3: AUTH & MEMBERSHIP (2025-02-04)
-- ============================================================================
-- Team invites and membership policies
\echo '>>> Applying: 20250204103000_auth_team_invites.sql'
\ir ../migrations/20250204103000_auth_team_invites.sql
INSERT INTO _migrations (name) VALUES ('20250204103000_auth_team_invites') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20250204114500_fix_membership_policy.sql'
\ir ../migrations/20250204114500_fix_membership_policy.sql
INSERT INTO _migrations (name) VALUES ('20250204114500_fix_membership_policy') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 4: PROFILE UPDATES (2025-10-06)
-- ============================================================================
-- Profile update requests and related policies
\echo '>>> Applying: 20251006170500_profile_update_requests.sql'
\ir ../migrations/20251006170500_profile_update_requests.sql
INSERT INTO _migrations (name) VALUES ('20251006170500_profile_update_requests') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251006170600_add_profile_update_policies.sql'
\ir ../migrations/20251006170600_add_profile_update_policies.sql
INSERT INTO _migrations (name) VALUES ('20251006170600_add_profile_update_policies') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 5: BOOKING ENHANCEMENTS (2025-10-10 to 2025-10-11)
-- ============================================================================
-- Booking options, reservation columns, and profile access
\echo '>>> Applying: 20251010165023_add_booking_option_and_reservation_columns.sql'
\ir ../migrations/20251010165023_add_booking_option_and_reservation_columns.sql
INSERT INTO _migrations (name) VALUES ('20251010165023_add_booking_option_and_reservation_columns') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251011091500_add_has_access_to_profiles.sql'
\ir ../migrations/20251011091500_add_has_access_to_profiles.sql
INSERT INTO _migrations (name) VALUES ('20251011091500_add_has_access_to_profiles') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 6: CAPACITY ENGINE & BOOKING LIFECYCLE (2025-10-16)
-- ============================================================================
-- Comprehensive booking system upgrades: inventory, capacity tracking, check-in/out

\echo '>>> Applying: 20251016091600_add_auth_user_id_to_bookings.sql'
\ir ../migrations/20251016091600_add_auth_user_id_to_bookings.sql
INSERT INTO _migrations (name) VALUES ('20251016091600_add_auth_user_id_to_bookings') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016091700_add_is_active_to_restaurants.sql'
\ir ../migrations/20251016091700_add_is_active_to_restaurants.sql
INSERT INTO _migrations (name) VALUES ('20251016091700_add_is_active_to_restaurants') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016091800_create_table_inventory.sql'
\ir ../migrations/20251016091800_create_table_inventory.sql
INSERT INTO _migrations (name) VALUES ('20251016091800_create_table_inventory') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016091900_create_booking_slots.sql'
\ir ../migrations/20251016091900_create_booking_slots.sql
INSERT INTO _migrations (name) VALUES ('20251016091900_create_booking_slots') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016092000_create_booking_table_assignments.sql'
\ir ../migrations/20251016092000_create_booking_table_assignments.sql
INSERT INTO _migrations (name) VALUES ('20251016092000_create_booking_table_assignments') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016092100_add_capacity_check_rpc.sql'
\ir ../migrations/20251016092100_add_capacity_check_rpc.sql
INSERT INTO _migrations (name) VALUES ('20251016092100_add_capacity_check_rpc') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016103000_add_capacity_rule_overrides.sql'
\ir ../migrations/20251016103000_add_capacity_rule_overrides.sql
INSERT INTO _migrations (name) VALUES ('20251016103000_add_capacity_rule_overrides') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016104500_create_capacity_metrics_hourly.sql'
\ir ../migrations/20251016104500_create_capacity_metrics_hourly.sql
INSERT INTO _migrations (name) VALUES ('20251016104500_create_capacity_metrics_hourly') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016221000_add_booking_check_io_columns.sql'
\ir ../migrations/20251016221000_add_booking_check_io_columns.sql
INSERT INTO _migrations (name) VALUES ('20251016221000_add_booking_check_io_columns') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016230000_booking_lifecycle_state_machine.sql'
\ir ../migrations/20251016230000_booking_lifecycle_state_machine.sql
INSERT INTO _migrations (name) VALUES ('20251016230000_booking_lifecycle_state_machine') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251016232000_booking_lifecycle_enhancements.sql'
\ir ../migrations/20251016232000_booking_lifecycle_enhancements.sql
INSERT INTO _migrations (name) VALUES ('20251016232000_booking_lifecycle_enhancements') ON CONFLICT DO NOTHING;

-- ============================================================================
-- PHASE 7: POST-CAPACITY REFINEMENTS (2025-10-17 to 2025-10-19)
-- ============================================================================
-- Timezone hardening, inventory foundations, conflict-safe allocations, and connectivity

\echo '>>> Applying: 20251017123500_harden_booking_timezone.sql'
\ir ../migrations/20251017123500_harden_booking_timezone.sql
INSERT INTO _migrations (name) VALUES ('20251017123500_harden_booking_timezone') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018103000_inventory_foundations.sql'
\ir ../migrations/20251018103000_inventory_foundations.sql
INSERT INTO _migrations (name) VALUES ('20251018103000_inventory_foundations') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018154000_conflict_safe_allocations.sql'
\ir ../migrations/20251018154000_conflict_safe_allocations.sql
INSERT INTO _migrations (name) VALUES ('20251018154000_conflict_safe_allocations') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018170500_fix_booking_serializable.sql'
\ir ../migrations/20251018170500_fix_booking_serializable.sql
INSERT INTO _migrations (name) VALUES ('20251018170500_fix_booking_serializable') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018171200_remove_serializable_set.sql'
\ir ../migrations/20251018171200_remove_serializable_set.sql
INSERT INTO _migrations (name) VALUES ('20251018171200_remove_serializable_set') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018172000_add_loyalty_points_awarded.sql'
\ir ../migrations/20251018172000_add_loyalty_points_awarded.sql
INSERT INTO _migrations (name) VALUES ('20251018172000_add_loyalty_points_awarded') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018223000_assign_tables_atomic_enhancements.sql'
\ir ../migrations/20251018223000_assign_tables_atomic_enhancements.sql
INSERT INTO _migrations (name) VALUES ('20251018223000_assign_tables_atomic_enhancements') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018223500_table_status_triggers.sql'
\ir ../migrations/20251018223500_table_status_triggers.sql
INSERT INTO _migrations (name) VALUES ('20251018223500_table_status_triggers') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251018224000_allocations_maintenance_support.sql'
\ir ../migrations/20251018224000_allocations_maintenance_support.sql
INSERT INTO _migrations (name) VALUES ('20251018224000_allocations_maintenance_support') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251019000500_allowed_capacities.sql'
\ir ../migrations/20251019000500_allowed_capacities.sql
INSERT INTO _migrations (name) VALUES ('20251019000500_allowed_capacities') ON CONFLICT DO NOTHING;

\echo '>>> Applying: 20251019001550_merge_group_connectivity.sql'
\ir ../migrations/20251019001550_merge_group_connectivity.sql
INSERT INTO _migrations (name) VALUES ('20251019001550_merge_group_connectivity') ON CONFLICT DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
\echo ''
\echo '✅ All database migrations applied successfully!'
\echo ''
\echo 'Applied migrations:'
SELECT COUNT(*) || ' migrations' as total FROM _migrations;
\echo ''
\echo 'Next step: Run supabase/init-seeds.sql to populate test data'
\echo ''
