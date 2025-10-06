-- Add composite unique constraint aligning with application upsert logic
ALTER TABLE public.customers
  ADD CONSTRAINT customers_restaurant_email_phone_key
  UNIQUE (restaurant_id, email_normalized, phone_normalized);
