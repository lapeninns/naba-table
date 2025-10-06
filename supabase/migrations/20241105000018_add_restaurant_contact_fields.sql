-- Add contact details to restaurants for dynamic venue information

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS booking_policy text;

-- Seed existing rows with the legacy defaults so current tenants keep the same details
UPDATE public.restaurants
SET
  contact_email = COALESCE(contact_email, 'reservations@SajiloReserveX.co.uk'),
  contact_phone = COALESCE(contact_phone, '+44 20 1234 5678'),
  address = COALESCE(address, '12 Market Row, London SE1 0AA'),
  booking_policy = COALESCE(
    booking_policy,
    'You can cancel or amend up to 24 hours before your reservation. After that window please call the venue and we’ll do our best to help.'
  );
