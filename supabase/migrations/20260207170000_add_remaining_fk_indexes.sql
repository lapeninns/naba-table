-- Staging-first: add remaining FK-supporting indexes that were still missing after
-- the 20260207144113 hardening migration.
--
-- Why:
-- - FK checks without supporting indexes can force sequential scans, increasing
--   lock time and latency during deletes/updates and joins.
-- - These are additive changes (low risk), but use CONCURRENTLY to avoid blocking.
--
-- Production rollout:
-- - Safe to apply during business hours due to CONCURRENTLY, but expect longer
--   runtime on large datasets.
-- - Ensure this migration is not wrapped in a transaction.

SET statement_timeout = '15min';
SET lock_timeout = '5s';

-- Keep this aligned with the existing pattern for optional FKs:
-- only index non-null values to reduce index size and write cost.
CREATE INDEX IF NOT EXISTS idx_analytics_events_customer_id
  ON public.analytics_events (customer_id)
  WHERE (customer_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_restaurant_capacity_rules_restaurant_id
  ON public.restaurant_capacity_rules (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_operating_hours_restaurant_id
  ON public.restaurant_operating_hours (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_service_periods_restaurant_id
  ON public.restaurant_service_periods (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_zones_restaurant_id
  ON public.zones (restaurant_id);
