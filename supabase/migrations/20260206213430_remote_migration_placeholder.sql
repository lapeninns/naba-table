-- Placeholder migration.
--
-- This version exists in the remote Supabase migration history table, but the
-- original SQL was not present in this repo snapshot at the time we needed to
-- ship subsequent migrations.
--
-- IMPORTANT:
-- - This file is intentionally a no-op.
-- - It is NOT a substitute for the real migration content.
-- - Follow-up required: recover/restore the original SQL or replace with an
--   equivalent, reviewed migration that matches the remote schema change.
--
-- Keeping this file allows `supabase db push` / migration tooling to reconcile
-- local vs remote history without unsafe `migration repair` operations.

begin;
-- no-op
commit;

