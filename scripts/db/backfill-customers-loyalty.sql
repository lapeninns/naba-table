-- Rebuild customers, customer_profiles, and loyalty aggregates from bookings data.
-- This script is idempotent and can be rerun to repair drift between bookings,
-- customers, customer_profiles, loyalty_points, and loyalty_point_events.

BEGIN;

-- Refresh customers from bookings contact data.
WITH normalized_bookings AS (
  SELECT
    b.id,
    b.restaurant_id,
    lower(b.customer_email::text) AS email,
    regexp_replace(b.customer_phone, '\\s+', '', 'g') AS phone_key,
    b.customer_phone,
    b.customer_name,
    b.marketing_opt_in,
    b.created_at,
    b.updated_at
  FROM public.bookings b
)
INSERT INTO public.customers (restaurant_id, email, phone, full_name, marketing_opt_in)
SELECT
  nb.restaurant_id,
  nb.email,
  CASE
    WHEN nb.customer_phone LIKE '+%' THEN '+' || nb.phone_key
    ELSE nb.customer_phone
  END,
  (ARRAY_REMOVE(ARRAY_AGG(nb.customer_name ORDER BY nb.created_at DESC), NULL))[1],
  bool_or(nb.marketing_opt_in)
FROM normalized_bookings nb
GROUP BY nb.restaurant_id, nb.email, nb.phone_key
ON CONFLICT (restaurant_id, email_normalized, phone_normalized) DO UPDATE
SET
  full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name),
  marketing_opt_in = public.customers.marketing_opt_in OR EXCLUDED.marketing_opt_in,
  updated_at = now();

-- Attach customers to bookings.
WITH matches AS (
  SELECT
    b.id AS booking_id,
    c.id AS customer_id
  FROM public.bookings b
  JOIN public.customers c
    ON c.restaurant_id = b.restaurant_id
   AND c.email_normalized = lower(b.customer_email::text)
   AND c.phone_normalized = regexp_replace(b.customer_phone, '[^0-9]+', '', 'g')
)
UPDATE public.bookings AS b
SET customer_id = m.customer_id
FROM matches m
WHERE b.id = m.booking_id
  AND (b.customer_id IS DISTINCT FROM m.customer_id);

-- Rebuild customer profiles.
WITH booking_summary AS (
  SELECT
    b.customer_id,
    min(b.created_at) AS first_booking_at,
    max(b.created_at) AS last_booking_at,
    COUNT(*) AS total_bookings,
    COUNT(*) FILTER (WHERE b.status = 'cancelled') AS total_cancellations,
    SUM(b.party_size) AS total_covers,
    bool_or(b.marketing_opt_in) AS marketing_opt_in,
    max(CASE WHEN b.marketing_opt_in THEN b.updated_at ELSE NULL END) AS last_marketing_opt_in_at
  FROM public.bookings b
  GROUP BY b.customer_id
),
INSERT INTO public.customer_profiles (
  customer_id,
  first_booking_at,
  last_booking_at,
  total_bookings,
  total_cancellations,
  total_covers,
  marketing_opt_in,
  last_marketing_opt_in_at,
  updated_at
)
SELECT
  c.id,
  bs.first_booking_at,
  bs.last_booking_at,
  COALESCE(bs.total_bookings, 0),
  COALESCE(bs.total_cancellations, 0),
  COALESCE(bs.total_covers, 0),
  COALESCE(bs.marketing_opt_in, false),
  bs.last_marketing_opt_in_at,
  now()
FROM public.customers c
LEFT JOIN booking_summary bs ON bs.customer_id = c.id
ON CONFLICT (customer_id) DO UPDATE SET
  first_booking_at = COALESCE(customer_profiles.first_booking_at, EXCLUDED.first_booking_at),
  last_booking_at = GREATEST(customer_profiles.last_booking_at, EXCLUDED.last_booking_at),
  total_bookings = EXCLUDED.total_bookings,
  total_cancellations = EXCLUDED.total_cancellations,
  total_covers = EXCLUDED.total_covers,
  marketing_opt_in = customer_profiles.marketing_opt_in OR EXCLUDED.marketing_opt_in,
  last_marketing_opt_in_at = GREATEST(customer_profiles.last_marketing_opt_in_at, EXCLUDED.last_marketing_opt_in_at),
  updated_at = EXCLUDED.updated_at;

-- Recalculate loyalty balances from bookings.
WITH program_map AS (
  SELECT restaurant_id, id AS program_id
  FROM public.loyalty_programs
),
booking_loyalty AS (
  SELECT
    b.customer_id,
    b.restaurant_id,
    SUM(GREATEST(b.loyalty_points_awarded, 0)) AS total_points,
    SUM(GREATEST(b.loyalty_points_awarded, 0)) AS lifetime_points,
    MAX(CASE WHEN b.loyalty_points_awarded > 0 THEN b.updated_at ELSE NULL END) AS last_awarded_at
  FROM public.bookings b
  GROUP BY b.customer_id, b.restaurant_id
)
INSERT INTO public.loyalty_points (
  program_id,
  customer_id,
  balance,
  lifetime_points,
  tier,
  last_awarded_at,
  updated_at
)
SELECT
  pm.program_id,
  bl.customer_id,
  COALESCE(bl.total_points, 0),
  COALESCE(bl.lifetime_points, 0),
  CASE
    WHEN COALESCE(bl.total_points, 0) >= 500 THEN 'platinum'
    WHEN COALESCE(bl.total_points, 0) >= 250 THEN 'gold'
    WHEN COALESCE(bl.total_points, 0) >= 100 THEN 'silver'
    ELSE 'bronze'
  END::public.loyalty_tier,
  bl.last_awarded_at,
  now()
FROM booking_loyalty bl
JOIN program_map pm ON pm.restaurant_id = bl.restaurant_id
ON CONFLICT (program_id, customer_id) DO UPDATE
SET
  balance = EXCLUDED.balance,
  lifetime_points = EXCLUDED.lifetime_points,
  tier = EXCLUDED.tier,
  last_awarded_at = EXCLUDED.last_awarded_at,
  updated_at = EXCLUDED.updated_at;

-- Rebuild ledger entries from bookings history.
DELETE FROM public.loyalty_point_events;

WITH program_map AS (
  SELECT restaurant_id, id AS program_id
  FROM public.loyalty_programs
),
ordered AS (
  SELECT
    b.id AS booking_id,
    b.customer_id,
    b.restaurant_id,
    b.loyalty_points_awarded,
    b.created_at,
    b.updated_at,
    SUM(GREATEST(b.loyalty_points_awarded, 0)) OVER (
      PARTITION BY b.customer_id
      ORDER BY b.created_at, b.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
  FROM public.bookings b
  WHERE b.loyalty_points_awarded IS NOT NULL
)
INSERT INTO public.loyalty_point_events (
  program_id,
  customer_id,
  booking_id,
  points_delta,
  balance_after,
  reason,
  metadata,
  occurred_at
)
SELECT
  pm.program_id,
  o.customer_id,
  o.booking_id,
  COALESCE(o.loyalty_points_awarded, 0),
  COALESCE(o.running_balance, 0),
  CASE WHEN COALESCE(o.loyalty_points_awarded, 0) > 0 THEN 'booking.confirmed' ELSE 'booking.adjustment' END,
  jsonb_build_object('rebuild', true),
  COALESCE(o.updated_at, o.created_at)
FROM ordered o
JOIN program_map pm ON pm.restaurant_id = o.restaurant_id
WHERE o.loyalty_points_awarded <> 0
ON CONFLICT (booking_id, reason) DO NOTHING;

COMMIT;
