-- Adds metadata and soft-delete support for booking occasions and introduces audit log table.

BEGIN;

ALTER TABLE public.booking_occasions
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Use a DO block to add the constraint iff it doesn't already exist. Some Postgres
-- versions don't support `ADD CONSTRAINT IF NOT EXISTS`, so a conditional
-- block ensures this migration is idempotent and compatible.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_occasions_builtin_not_deleted'
  ) THEN
    EXECUTE $$ALTER TABLE public.booking_occasions
      ADD CONSTRAINT booking_occasions_builtin_not_deleted
      CHECK (NOT (is_builtin AND deleted_at IS NOT NULL));$$;
  END IF;
END
$do$;

-- Backfill builtin markers for core occasions.
UPDATE public.booking_occasions
SET is_builtin = true
WHERE key IN ('lunch', 'dinner', 'drinks');

-- Helpful indexes for ordering and active queries.
CREATE INDEX IF NOT EXISTS booking_occasions_display_order_idx
  ON public.booking_occasions (display_order);

CREATE INDEX IF NOT EXISTS booking_occasions_active_idx
  ON public.booking_occasions (is_active, deleted_at)
  WHERE deleted_at IS NULL;

-- Audit trail for CRUD actions on booking occasions.
CREATE TABLE IF NOT EXISTS public.booking_occasions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_key text NOT NULL,
  action text NOT NULL,
  before_change jsonb,
  after_change jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_occasions_audit_key_idx
  ON public.booking_occasions_audit (occasion_key);

COMMIT;
