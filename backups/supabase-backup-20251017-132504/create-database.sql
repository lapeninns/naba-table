-- Supabase master schema loader.
-- Usage:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/create-database.sql
-- Applies baseline schema snapshot followed by incremental migrations.

\set ON_ERROR_STOP on
BEGIN;

-- Baseline schema snapshot (2025-10-06)
\ir migrations/20251006170446_remote_schema.sql

-- Incremental migrations
\ir migrations/20250115093000_add_profile_update_policies.sql
\ir migrations/20250204103000_auth_team_invites.sql
\ir migrations/20250204114500_fix_membership_policy.sql
\ir migrations/20251006170500_profile_update_requests.sql
\ir migrations/20251006170600_add_profile_update_policies.sql
\ir migrations/20251010165023_add_booking_option_and_reservation_columns.sql
\ir migrations/20251011091500_add_has_access_to_profiles.sql

COMMIT;
