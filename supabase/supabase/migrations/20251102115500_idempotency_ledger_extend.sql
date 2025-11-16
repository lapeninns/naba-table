-- Extend booking_assignment_idempotency with payload checksum and expiry window
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'booking_assignment_idempotency' AND column_name = 'payload_checksum'
  ) IS FALSE THEN
    ALTER TABLE public.booking_assignment_idempotency
      ADD COLUMN payload_checksum text NOT NULL DEFAULT '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'booking_assignment_idempotency' AND column_name = 'expires_at'
  ) IS FALSE THEN
    ALTER TABLE public.booking_assignment_idempotency
      ADD COLUMN expires_at timestamptz NULL;
  END IF;
END $$;
-- Optional index if frequently querying by (booking_id, idempotency_key)
CREATE INDEX IF NOT EXISTS booking_assignment_idempo_bkid_key_idx
  ON public.booking_assignment_idempotency (booking_id, idempotency_key);
