-- Apply remaining migrations (20251017 - 20251019)
-- These were added after the initial init-database.sql was created

\set ON_ERROR_STOP on

\echo '>>> Applying remaining migrations...'
\echo ''

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

\echo ''
\echo '✅ Remaining migrations applied!'
\echo ''
SELECT COUNT(*) || ' total migrations' as summary FROM _migrations;
\echo ''
