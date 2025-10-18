-- Migration: Inventory Foundations Alignment
-- Description: Introduce zones, adjacency, merge rules, allocations, and update table inventory schema
-- Date: 2025-10-18

-- =====================================================
-- 1. Rename legacy seating type and create new enums
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'table_inventory'
      AND column_name = 'seating_type'
  ) THEN
    ALTER TABLE public.table_inventory
      RENAME COLUMN seating_type TO seating_location;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seating_type'
  ) THEN
    ALTER TYPE public.seating_type RENAME TO seating_location_type;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seating_location_type'
  ) THEN
    CREATE TYPE public.seating_location_type AS ENUM ('indoor', 'outdoor', 'bar', 'private_room');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_category') THEN
    CREATE TYPE public.table_category AS ENUM ('bar', 'dining', 'lounge', 'patio', 'private');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_mobility') THEN
    CREATE TYPE public.table_mobility AS ENUM ('movable', 'fixed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_seating_type') THEN
    CREATE TYPE public.table_seating_type AS ENUM ('standard', 'sofa', 'booth', 'high_top');
  END IF;
END $$;

-- =====================================================
-- 2. Zones table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zones_name_not_blank CHECK (char_length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS zones_restaurant_name_idx
  ON public.zones (restaurant_id, lower(name));

CREATE TRIGGER zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage zones"
  ON public.zones
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can manage zones"
  ON public.zones
  TO authenticated
  USING (restaurant_id IN (SELECT public.user_restaurants()))
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT SELECT ON public.zones TO anon;

-- =====================================================
-- 3. Alter table_inventory structure
-- =====================================================
ALTER TABLE public.table_inventory
  ADD COLUMN IF NOT EXISTS zone_id uuid,
  ADD COLUMN IF NOT EXISTS category public.table_category,
  ADD COLUMN IF NOT EXISTS seating_type public.table_seating_type NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS mobility public.table_mobility NOT NULL DEFAULT 'movable',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Drop legacy capacity constraint and replace with sprint-specific rule
ALTER TABLE public.table_inventory
  DROP CONSTRAINT IF EXISTS table_inventory_valid_capacity;

-- Normalise existing capacity values before enforcing the new constraint
UPDATE public.table_inventory
SET capacity = CASE
  WHEN capacity IS NULL THEN 2
  WHEN capacity <= 2 THEN 2
  WHEN capacity BETWEEN 3 AND 4 THEN 4
  WHEN capacity = 5 THEN 5
  WHEN capacity = 6 THEN 5
  WHEN capacity = 8 THEN 7
  WHEN capacity >= 9 THEN 7
  ELSE capacity
END
WHERE capacity NOT IN (2, 4, 5, 7);

ALTER TABLE public.table_inventory
  ADD CONSTRAINT table_inventory_capacity_allowed
    CHECK (capacity IN (2, 4, 5, 7));

-- Ensure min_party_size remains positive
ALTER TABLE public.table_inventory
  ADD CONSTRAINT table_inventory_min_party_positive
    CHECK (min_party_size > 0);

-- Helper: create default zone per restaurant for backfill
INSERT INTO public.zones (restaurant_id, name, sort_order)
SELECT r.id, 'Main Floor', 0
FROM public.restaurants r
ON CONFLICT (restaurant_id, lower(name)) DO NOTHING;

-- Backfill new columns for existing tables
UPDATE public.table_inventory ti
SET
  zone_id = COALESCE(zone_map.zone_id, zone_map.default_zone_id),
  category = COALESCE(zone_map.category, 'dining'::public.table_category),
  seating_type = COALESCE(zone_map.seating_type, 'standard'::public.table_seating_type),
  mobility = COALESCE(zone_map.mobility, 'movable'::public.table_mobility)
FROM (
  SELECT
    ti_inner.id AS table_id,
    z.id AS zone_id,
    z_default.id AS default_zone_id,
    CASE ti_inner.seating_location
      WHEN 'bar' THEN 'bar'
      WHEN 'patio' THEN 'patio'
      WHEN 'outdoor' THEN 'patio'
      WHEN 'private_room' THEN 'private'
      ELSE 'dining'
    END::public.table_category AS category,
    CASE ti_inner.seating_location
      WHEN 'bar' THEN 'high_top'
      ELSE 'standard'
    END::public.table_seating_type AS seating_type,
    CASE ti_inner.seating_location
      WHEN 'bar' THEN 'fixed'
      ELSE 'movable'
    END::public.table_mobility AS mobility
  FROM public.table_inventory ti_inner
  LEFT JOIN public.zones z
    ON z.restaurant_id = ti_inner.restaurant_id
    AND lower(z.name) = lower(COALESCE(ti_inner.section, ''))
  LEFT JOIN LATERAL (
    SELECT z2.id
    FROM public.zones z2
    WHERE z2.restaurant_id = ti_inner.restaurant_id
    ORDER BY (lower(z2.name) = 'main floor') DESC,
             z2.sort_order ASC,
             z2.created_at ASC
    LIMIT 1
  ) AS z_default ON TRUE
) AS zone_map
WHERE ti.id = zone_map.table_id;

-- Fallback: set any remaining nulls explicitly
UPDATE public.table_inventory SET
  zone_id = z.id
FROM (
  SELECT ti.id AS table_id, z.id
  FROM public.table_inventory ti
  JOIN LATERAL (
    SELECT z2.id
    FROM public.zones z2
    WHERE z2.restaurant_id = ti.restaurant_id
    ORDER BY (lower(z2.name) = 'main floor') DESC,
             z2.sort_order ASC,
             z2.created_at ASC
    LIMIT 1
  ) AS z ON TRUE
) AS z
WHERE public.table_inventory.id = z.table_id
  AND public.table_inventory.zone_id IS NULL;

UPDATE public.table_inventory
SET category = 'dining'
WHERE category IS NULL;

UPDATE public.table_inventory
SET seating_type = 'standard'
WHERE seating_type IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE public.table_inventory
  ALTER COLUMN zone_id SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN seating_type SET NOT NULL,
  ALTER COLUMN mobility SET NOT NULL,
  ALTER COLUMN active SET NOT NULL;

-- Add foreign key for zone
ALTER TABLE public.table_inventory
  ADD CONSTRAINT table_inventory_zone_id_fkey
    FOREIGN KEY (zone_id)
    REFERENCES public.zones(id)
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS table_inventory_zone_idx
  ON public.table_inventory (zone_id);

-- Remove legacy seating_location column and type if unused
ALTER TABLE public.table_inventory
  DROP COLUMN IF EXISTS seating_location;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND udt_name = 'seating_location_type'
  ) THEN
    DROP TYPE IF EXISTS public.seating_location_type;
  END IF;
END $$;

-- =====================================================
-- 4. Table adjacency table + symmetry helpers
-- (rest of migration remains unchanged)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.table_adjacencies (
  table_a uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  table_b uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_adjacencies_pkey PRIMARY KEY (table_a, table_b),
  CONSTRAINT table_adjacencies_not_equal CHECK (table_a <> table_b)
);

CREATE INDEX IF NOT EXISTS table_adjacencies_table_b_idx
  ON public.table_adjacencies (table_b);

CREATE OR REPLACE FUNCTION public.validate_table_adjacency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  zone_a uuid;
  zone_b uuid;
BEGIN
  SELECT zone_id INTO zone_a FROM public.table_inventory WHERE id = NEW.table_a;
  SELECT zone_id INTO zone_b FROM public.table_inventory WHERE id = NEW.table_b;

  IF zone_a IS NULL OR zone_b IS NULL THEN
    RAISE EXCEPTION 'Tables must belong to zones before adjacency can be created';
  END IF;

  IF zone_a <> zone_b THEN
    RAISE EXCEPTION 'Adjacency requires tables to be in the same zone';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER table_adjacencies_validate
  BEFORE INSERT ON public.table_adjacencies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_table_adjacency();

CREATE OR REPLACE FUNCTION public.sync_table_adjacency_symmetry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.table_adjacencies
      WHERE table_a = NEW.table_b AND table_b = NEW.table_a
    ) THEN
      IF NEW.table_a::text < NEW.table_b::text THEN
        INSERT INTO public.table_adjacencies(table_a, table_b)
        VALUES (NEW.table_b, NEW.table_a)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.table_adjacencies
    WHERE table_a = OLD.table_b AND table_b = OLD.table_a;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER table_adjacencies_sync
  AFTER INSERT OR DELETE ON public.table_adjacencies
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_table_adjacency_symmetry();

ALTER TABLE public.table_adjacencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage adjacencies"
  ON public.table_adjacencies
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can manage adjacencies"
  ON public.table_adjacencies
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.table_inventory ti
      WHERE ti.id = table_adjacencies.table_a
        AND ti.restaurant_id IN (SELECT public.user_restaurants())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.table_inventory ti
      WHERE ti.id = table_adjacencies.table_a
        AND ti.restaurant_id IN (SELECT public.user_restaurants())
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_adjacencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_adjacencies TO authenticated;
GRANT SELECT ON public.table_adjacencies TO anon;

-- =====================================================
-- 5. Merge rules
-- =====================================================
CREATE TABLE IF NOT EXISTS public.merge_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_a smallint NOT NULL,
  from_b smallint NOT NULL,
  to_capacity smallint NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  require_same_zone boolean NOT NULL DEFAULT true,
  require_adjacency boolean NOT NULL DEFAULT true,
  cross_category_merge boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT merge_rules_positive CHECK (from_a > 0 AND from_b > 0 AND to_capacity > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS merge_rules_from_to_idx
  ON public.merge_rules (from_a, from_b, to_capacity);

CREATE TRIGGER merge_rules_updated_at
  BEFORE UPDATE ON public.merge_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.merge_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage merge rules"
  ON public.merge_rules
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view merge rules"
  ON public.merge_rules
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merge_rules TO service_role;
GRANT SELECT ON public.merge_rules TO authenticated;
GRANT SELECT ON public.merge_rules TO anon;

INSERT INTO public.merge_rules (from_a, from_b, to_capacity)
VALUES
  (2, 4, 6),
  (4, 4, 8)
ON CONFLICT (from_a, from_b, to_capacity) DO NOTHING;

-- =====================================================
-- 6. Service policy configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lunch_start time NOT NULL DEFAULT time '12:00',
  lunch_end time NOT NULL DEFAULT time '15:00',
  dinner_start time NOT NULL DEFAULT time '17:00',
  dinner_end time NOT NULL DEFAULT time '22:00',
  clean_buffer_minutes smallint NOT NULL DEFAULT 5,
  allow_after_hours boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER service_policy_updated_at
  BEFORE UPDATE ON public.service_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.service_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage service policy"
  ON public.service_policy
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view service policy"
  ON public.service_policy
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_policy TO service_role;
GRANT SELECT ON public.service_policy TO authenticated;
GRANT SELECT ON public.service_policy TO anon;

INSERT INTO public.service_policy (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.service_policy);

-- =====================================================
-- 7. Allocation tables for merged seating
-- =====================================================
CREATE TABLE IF NOT EXISTS public.merge_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capacity smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dissolved_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.merge_group_members (
  merge_group_id uuid NOT NULL REFERENCES public.merge_groups(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.table_inventory(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merge_group_id, table_id)
);

CREATE TABLE IF NOT EXISTS public.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('table', 'merge_group')),
  resource_id uuid NOT NULL,
  block_start timestamptz NOT NULL,
  block_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  shadow boolean NOT NULL DEFAULT false,
  CONSTRAINT allocations_block_valid CHECK (block_end > block_start)
);

CREATE TRIGGER allocations_updated_at
  BEFORE UPDATE ON public.allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS allocations_resource_idx
  ON public.allocations (resource_type, resource_id, block_start, block_end);

CREATE OR REPLACE FUNCTION public.allocations_overlap(resource uuid, rtype text, start_at timestamptz, end_at timestamptz)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allocations a
    WHERE a.resource_id = resource
      AND a.resource_type = rtype
      AND tstzrange(a.block_start, a.block_end, '[)') && tstzrange(start_at, end_at, '[)')
  );
$$;

ALTER TABLE public.merge_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merge_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage merge groups"
  ON public.merge_groups
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage merge group members"
  ON public.merge_group_members
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage allocations"
  ON public.allocations
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Staff can view allocations"
  ON public.allocations
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merge_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merge_group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allocations TO service_role;
GRANT SELECT ON public.merge_groups TO authenticated;
GRANT SELECT ON public.merge_group_members TO authenticated;
GRANT SELECT ON public.allocations TO authenticated;

GRANT SELECT ON public.merge_groups TO anon;
GRANT SELECT ON public.merge_group_members TO anon;
GRANT SELECT ON public.allocations TO anon;

-- =====================================================
-- Migration complete
-- =====================================================
