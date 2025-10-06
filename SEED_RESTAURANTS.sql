-- ============================================================================
-- SEED DATA - Sample Restaurants
-- Run this if you don't have any restaurants in your database
-- ============================================================================

-- Insert sample restaurants
INSERT INTO public.restaurants (name, slug, timezone, capacity) VALUES
  ('The Garden Bistro', 'the-garden-bistro', 'America/New_York', 50),
  ('Coastal Kitchen', 'coastal-kitchen', 'America/Los_Angeles', 80),
  ('Urban Grill', 'urban-grill', 'America/Chicago', 100),
  ('Riverside Cafe', 'riverside-cafe', 'Europe/London', 60),
  ('Mountain View Restaurant', 'mountain-view-restaurant', 'America/Denver', 120),
  ('Sunset Terrace', 'sunset-terrace', 'Asia/Tokyo', 40),
  ('Harbor House', 'harbor-house', 'Australia/Sydney', 75),
  ('Plaza Dining', 'plaza-dining', 'Europe/Paris', 90)
ON CONFLICT (slug) DO NOTHING;

-- Verify insertion
SELECT 
  'Inserted Restaurants' as section,
  id,
  name,
  slug,
  timezone,
  capacity
FROM public.restaurants
ORDER BY created_at DESC;

SELECT 
  'Total Count' as section,
  count(*) as total_restaurants
FROM public.restaurants;
