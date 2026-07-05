-- Replace the full unique keys on customers contact columns with partial unique
-- indexes. Empty string means "contact not provided", so two customers without a
-- phone (or without an email) must not collide on the '' key; the pair key
-- (restaurant_id, email_normalized, phone_normalized) stays as-is.
-- Index names are kept identical so 23505 handling and log parsing are unchanged.

BEGIN;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_restaurant_id_email_normalized_key;
DROP INDEX IF EXISTS public.customers_restaurant_id_email_normalized_key;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_restaurant_id_phone_normalized_key;
DROP INDEX IF EXISTS public.customers_restaurant_id_phone_normalized_key;

CREATE UNIQUE INDEX customers_restaurant_id_email_normalized_key
  ON public.customers (restaurant_id, email_normalized)
  WHERE email_normalized <> '';

CREATE UNIQUE INDEX customers_restaurant_id_phone_normalized_key
  ON public.customers (restaurant_id, phone_normalized)
  WHERE phone_normalized <> '';

COMMIT;
