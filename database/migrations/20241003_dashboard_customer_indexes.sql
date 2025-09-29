-- Dashboard /customer email normalization & lookup indexes
-- NOTE: CREATE INDEX CONCURRENTLY requires statements to run outside a transaction.

-- Backfill any legacy mixed-case emails so the forthcoming constraint passes.
UPDATE public.bookings
SET customer_email = lower(customer_email::text)
WHERE customer_email <> lower(customer_email::text);

-- Enforce lowercase storage from now on (idempotent guard).
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bookings_customer_email_lower'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_email_lower
      CHECK (customer_email = lower(customer_email::text));
  END IF;
END
$blk$;

-- Customer-scoped booking lookup (email)
CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_customer_email_start_idx
  ON public.bookings (lower(customer_email::text), start_at DESC)
  INCLUDE (restaurant_id, status, party_size, end_at, customer_id, notes);

-- Customer-scoped booking lookup (customer_id fallback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_customer_id_start_idx
  ON public.bookings (customer_id, start_at DESC)
  INCLUDE (restaurant_id, status, party_size, customer_email, end_at);

-- Cross-restaurant customer search by normalized email
CREATE INDEX CONCURRENTLY IF NOT EXISTS customers_email_global_idx
  ON public.customers (email_normalized);
