-- Populate restaurant contact details with tenant-specific information

-- Update The Old Crown Pub
UPDATE public.restaurants
SET
  contact_email = 'reservations@oldcrownpub.co.uk',
  contact_phone = '+44 20 7123 4567',
  address = '33 New Oxford Street, London WC1A 1BH',
  booking_policy = 'Reservations can be cancelled or modified up to 24 hours before your booking. For same-day changes, please call us directly at +44 20 7123 4567.'
WHERE slug = 'old-crown-pub' OR name ILIKE '%old crown%';

-- Update The Queen Elizabeth Pub
UPDATE public.restaurants
SET
  contact_email = 'bookings@queenelizabethpub.com',
  contact_phone = '+44 20 7456 7890',
  address = '45 Westminster Bridge Road, London SE1 7EH',
  booking_policy = 'We kindly request 24 hours notice for cancellations or amendments. For bookings within 24 hours, please contact us at +44 20 7456 7890 and we''ll be happy to assist.'
WHERE slug = 'the-queen-elizabeth-pub' OR name ILIKE '%queen elizabeth%';

-- Update The Jolly Sailor
UPDATE public.restaurants
SET
  contact_email = 'hello@jollysailor.london',
  contact_phone = '+44 20 7234 5678',
  address = '17 Dockside Lane, London E14 8QS',
  booking_policy = 'Cancellations must be made at least 24 hours in advance. For later changes or same-day bookings, ring us on +44 20 7234 5678 and we''ll do our best to help.'
WHERE slug = 'the-jolly-sailor' OR name ILIKE '%jolly sailor%';

-- Update The Royal Oak
UPDATE public.restaurants
SET
  contact_email = 'reservations@royaloaklondon.co.uk',
  contact_phone = '+44 20 7890 1234',
  address = '2 Victoria Street, London SW1H 0ND',
  booking_policy = 'Please allow 24 hours for cancellations or modifications. If you need to make changes within 24 hours of your reservation, please call +44 20 7890 1234.'
WHERE slug = 'the-royal-oak' OR name ILIKE '%royal oak%';

-- For any other restaurants not specifically named above, set generic but professional details
UPDATE public.restaurants
SET
  contact_email = COALESCE(contact_email, 'reservations@' || LOWER(REPLACE(slug, '-', '')) || '.co.uk'),
  contact_phone = COALESCE(contact_phone, '+44 20 7' || LPAD((random() * 999)::int::text, 3, '0') || ' ' || LPAD((random() * 9999)::int::text, 4, '0')),
  address = COALESCE(address, INITCAP(REPLACE(slug, '-', ' ')) || ', London'),
  booking_policy = COALESCE(
    booking_policy,
    'You can cancel or modify your reservation up to 24 hours in advance. For changes within 24 hours, please contact us directly and we will assist you.'
  )
WHERE contact_email IS NULL OR contact_phone IS NULL OR address IS NULL OR booking_policy IS NULL;

-- Display updated restaurants
SELECT 
  name,
  slug,
  contact_email,
  contact_phone,
  address,
  LEFT(booking_policy, 80) || '...' as policy_preview
FROM public.restaurants
ORDER BY name;
