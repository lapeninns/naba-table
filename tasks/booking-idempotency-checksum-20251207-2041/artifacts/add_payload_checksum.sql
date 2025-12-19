-- Hotfix: add missing payload_checksum column used by confirm_hold_assignment_tx
ALTER TABLE public.booking_assignment_idempotency
  ADD COLUMN IF NOT EXISTS payload_checksum text;

-- Optional backfill (run if desired to fill existing rows with placeholder nulls; adjust if checksums needed)
-- UPDATE public.booking_assignment_idempotency SET payload_checksum = NULL WHERE payload_checksum IS NULL;

-- Rollback (if required)
-- ALTER TABLE public.booking_assignment_idempotency DROP COLUMN IF EXISTS payload_checksum;
