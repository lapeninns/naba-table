BEGIN;

-- `expires_at` is a short-lived hold TTL, not the reservation window end.
-- Future bookings must be allowed to create holds that expire before `end_at`;
-- otherwise auto-assignment treats every viable table as a hold conflict.
ALTER TABLE public.table_holds
  DROP CONSTRAINT IF EXISTS th_times_consistent;

ALTER TABLE public.table_holds
  ADD CONSTRAINT th_times_consistent
  CHECK (expires_at > created_at);

COMMENT ON CONSTRAINT th_times_consistent ON public.table_holds IS
  'Ensures hold TTL expires after creation. The hold expiry may be before the booking window end.';

COMMIT;
