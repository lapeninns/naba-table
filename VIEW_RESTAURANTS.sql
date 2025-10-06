-- View all restaurants and their current contact details
SELECT 
  id,
  name,
  slug,
  contact_email,
  contact_phone,
  address,
  booking_policy
FROM public.restaurants
ORDER BY name;
