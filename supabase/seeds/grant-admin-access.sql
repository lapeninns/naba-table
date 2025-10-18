-- Grant amanshresthaaaaa@gmail.com access to all restaurants
-- This script should be run after the user has signed up via Supabase Auth

WITH admin_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'amanshresthaaaaa@gmail.com'
  LIMIT 1
),
upserted_profile AS (
  INSERT INTO public.profiles (
    id,
    email,
    name,
    has_access,
    created_at,
    updated_at
  )
  SELECT
    id,
    'amanshresthaaaaa@gmail.com',
    'Aman Kumar Shrestha',
    true,
    now(),
    now()
  FROM admin_user
  WHERE EXISTS (SELECT 1 FROM admin_user)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    has_access = true,
    updated_at = now()
  RETURNING id
)
INSERT INTO public.restaurant_memberships (
  user_id,
  restaurant_id,
  role,
  created_at
)
SELECT
  upserted_profile.id,
  restaurants.id,
  'owner',
  now()
FROM upserted_profile
CROSS JOIN public.restaurants
WHERE EXISTS (SELECT 1 FROM upserted_profile)
ON CONFLICT (user_id, restaurant_id) DO UPDATE
SET
  role = EXCLUDED.role;

-- Show results
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'SUCCESS: Granted owner access to ' || COUNT(*)::text || ' restaurants for amanshresthaaaaa@gmail.com'
    ELSE 'INFO: User amanshresthaaaaa@gmail.com not found in auth.users. They need to sign up first.'
  END as result
FROM public.restaurant_memberships rm
JOIN auth.users u ON u.id = rm.user_id
WHERE u.email = 'amanshresthaaaaa@gmail.com';
