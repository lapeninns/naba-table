BEGIN;

-- Drop triggers first (before dropping functions they depend on)
DROP TRIGGER IF EXISTS capacity_metrics_hourly_set_updated_at ON public.capacity_metrics_hourly;
DROP TRIGGER IF EXISTS restaurant_capacity_rules_updated_at ON public.restaurant_capacity_rules;

-- Now drop capacity-related functions
DROP FUNCTION IF EXISTS public.capacity_metrics_hourly_updated_at();
DROP FUNCTION IF EXISTS public.increment_capacity_metrics(uuid, timestamptz, integer, integer, integer);
DROP FUNCTION IF EXISTS public.create_booking_with_capacity_check(
    uuid,
    uuid,
    date,
    time without time zone,
    time without time zone,
    integer,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean,
    text,
    text,
    uuid,
    text,
    jsonb,
    integer
);

-- Drop capacity tables
DROP TABLE IF EXISTS public.capacity_metrics_hourly CASCADE;
DROP TABLE IF EXISTS public.restaurant_capacity_rules CASCADE;

-- Drop capacity-specific enum type
DROP TYPE IF EXISTS public.capacity_override_type;

COMMIT;
