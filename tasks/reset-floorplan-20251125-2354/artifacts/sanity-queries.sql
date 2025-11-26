-- Sanity checks for new floorplan after seeding
-- Run with: psql "$SUPABASE_DB_URL" -f tasks/reset-floorplan-20251125-2354/artifacts/sanity-queries.sql

\pset format aligned
\pset tuples_only off

WITH r AS (
  SELECT id FROM public.restaurants WHERE slug = 'white-horse-pub-waterbeach' LIMIT 1
)
-- Zones summary
SELECT 'zones' AS section, name, area_type, sort_order
FROM public.zones z
WHERE z.restaurant_id = (SELECT id FROM r)
ORDER BY sort_order;

-- Table counts by zone and mobility
SELECT 'tables_by_zone' AS section, z.name, t.mobility, COUNT(*) AS tables, SUM(t.capacity) AS seats
FROM public.table_inventory t
JOIN public.zones z ON z.id = t.zone_id
WHERE t.restaurant_id = (SELECT id FROM r)
GROUP BY z.name, t.mobility
ORDER BY z.name, t.mobility;

-- Table counts by category
SELECT 'tables_by_category' AS section, t.category, COUNT(*) AS tables
FROM public.table_inventory t
WHERE t.restaurant_id = (SELECT id FROM r)
GROUP BY t.category
ORDER BY t.category;

-- Allowed capacities
SELECT 'allowed_capacities' AS section, capacity
FROM public.allowed_capacities
WHERE restaurant_id = (SELECT id FROM r)
ORDER BY capacity;

-- Verify bar trigger exists
SELECT 'trigger' AS section, tg.tgname AS trigger_name
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'booking_table_assignments'
  AND tg.tgname = 'bar_tables_drinks_only';
