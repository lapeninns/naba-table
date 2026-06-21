-- Placeholder migration (orphan capture).
--
-- Version 20260520180000 exists in the remote Supabase migration history
-- (applied on the staging project) but its original SQL was never committed to
-- this repo. This no-op file reconciles local vs remote history so
-- `supabase db push` / `supabase migration list` stop reporting it as a
-- remote-only migration.
--
-- IMPORTANT:
-- - Intentionally a no-op; NOT a substitute for the real migration content.
-- - Follow-up: recover the original SQL from the remote
--   `supabase_migrations.schema_migrations.statements` for this version, or
--   replace it with an equivalent reviewed migration, before relying on
--   repo/prod schema parity.

begin;
-- no-op
commit;
