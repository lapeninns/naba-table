-- ⚠️ WARNING: This will delete ALL tables, views, functions, and data in the 'public' schema
-- Use only if you want a completely fresh start for your own app data
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================
-- MVP RESTAURANT BOOKING SYSTEM (CREATE-ONLY, no auth schema writes)
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ======================
-- Types
-- ======================
CREATE TYPE booking_status AS ENUM ('confirmed','pending','cancelled','completed','no_show');
CREATE TYPE seating_type AS ENUM ('indoor','outdoor','bar','patio','private_room');
CREATE TYPE seating_preference_type AS ENUM ('any','indoor','outdoor','bar','window','quiet');

-- ======================
-- Tables
-- ======================

-- Tenants
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text NOT NULL DEFAULT 'Europe/London', -- IANA tz
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant memberships (no FK to auth.users to avoid auth schema perms)
CREATE TABLE public.restaurant_memberships (
  user_id uuid NOT NULL,  -- app-level user id (from auth.uid()), no FK to auth.users
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

-- Customers (scoped per restaurant)
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL CHECK (email = lower(email)),
  phone text NOT NULL CHECK (length(phone) >= 7 AND length(phone) <= 20),
  email_normalized text GENERATED ALWAYS AS (lower(trim(email))) STORED,
  phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]+', '', 'g')) STORED,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  auth_user_id uuid NULL, -- optional link to auth user (no FK to auth.users)
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, email_normalized),
  UNIQUE (restaurant_id, phone_normalized),
  UNIQUE (restaurant_id, email_normalized, phone_normalized)
);

-- Physical tables in a restaurant
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  seating_type seating_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, label)
);

-- Bookings
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,

  -- Local parts
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,

  -- Instants (computed by trigger)
  start_at timestamptz NOT NULL,
  end_at   timestamptz NOT NULL,

  party_size integer NOT NULL CHECK (party_size > 0),

  seating_preference seating_preference_type NOT NULL DEFAULT 'any',
  status booking_status NOT NULL DEFAULT 'confirmed',

  -- Snapshot of customer data at booking time
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,

  notes text,
  reference text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'web',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ======================
-- Functions & Triggers
-- ======================

-- updated_at auto-touch
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Human-friendly booking reference (retry if collision)
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- excludes 0/O/1/I
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_booking_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE ref text;
BEGIN
  IF COALESCE(NEW.reference,'') = '' THEN
    LOOP
      ref := public.generate_booking_reference();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE reference = ref);
    END LOOP;
    NEW.reference := ref;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_set_reference
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_reference();

-- Compute start_at/end_at from local date/time + restaurant timezone
CREATE OR REPLACE FUNCTION public.set_booking_instants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  tz text;
  sh int; sm int; ss double precision;
  eh int; em int; es double precision;
BEGIN
  SELECT timezone INTO tz FROM public.restaurants WHERE id = NEW.restaurant_id;

  sh := EXTRACT(HOUR   FROM NEW.start_time)::int;
  sm := EXTRACT(MINUTE FROM NEW.start_time)::int;
  ss := EXTRACT(SECOND FROM NEW.start_time);
  eh := EXTRACT(HOUR   FROM NEW.end_time)::int;
  em := EXTRACT(MINUTE FROM NEW.end_time)::int;
  es := EXTRACT(SECOND FROM NEW.end_time);

  NEW.start_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    sh, sm, ss, tz
                  );

  NEW.end_at := make_timestamptz(
                    EXTRACT(YEAR  FROM NEW.booking_date)::int,
                    EXTRACT(MONTH FROM NEW.booking_date)::int,
                    EXTRACT(DAY   FROM NEW.booking_date)::int,
                    eh, em, es, tz
               );

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_set_instants
  BEFORE INSERT OR UPDATE OF booking_date, start_time, end_time, restaurant_id
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_instants();

-- ======================
-- Integrity & Performance
-- ======================

-- Time sanity
ALTER TABLE public.bookings
  ADD CONSTRAINT chk_time_order CHECK (start_at < end_at);

-- Prevent overlapping bookings per table (for pending/confirmed)
ALTER TABLE public.bookings
  ADD CONSTRAINT no_overlap_per_table
  EXCLUDE USING gist (
    table_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (table_id IS NOT NULL AND status IN ('confirmed','pending'));

-- Indexes
CREATE INDEX idx_restaurants_slug            ON public.restaurants(slug);
CREATE INDEX idx_memberships_user           ON public.restaurant_memberships(user_id);
CREATE INDEX idx_memberships_restaurant     ON public.restaurant_memberships(restaurant_id);

CREATE INDEX idx_customers_restaurant       ON public.customers(restaurant_id);
CREATE INDEX idx_customers_email_normalized ON public.customers(restaurant_id, email_normalized);
CREATE INDEX idx_customers_phone_normalized ON public.customers(restaurant_id, phone_normalized);
CREATE INDEX idx_customers_auth_user        ON public.customers(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX idx_tables_restaurant          ON public.restaurant_tables(restaurant_id);
CREATE INDEX idx_tables_active              ON public.restaurant_tables(restaurant_id, is_active) WHERE is_active = true;

CREATE INDEX idx_bookings_restaurant        ON public.bookings(restaurant_id);
CREATE INDEX idx_bookings_customer          ON public.bookings(customer_id);
CREATE INDEX idx_bookings_table             ON public.bookings(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX idx_bookings_date              ON public.bookings(restaurant_id, booking_date);
CREATE INDEX idx_bookings_datetime          ON public.bookings(restaurant_id, start_at, end_at);
CREATE INDEX idx_bookings_status            ON public.bookings(restaurant_id, status);
CREATE INDEX idx_bookings_reference         ON public.bookings(reference);
CREATE INDEX idx_bookings_created           ON public.bookings(restaurant_id, created_at DESC);

-- ======================
-- RLS
-- ======================
ALTER TABLE public.restaurants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings               ENABLE ROW LEVEL SECURITY;

-- Helper: which restaurants the current user can access
-- NOTE: stays in public schema; calls auth.uid() (allowed)
CREATE OR REPLACE FUNCTION public.user_restaurants()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT restaurant_id
  FROM public.restaurant_memberships
  WHERE user_id = auth.uid()
$$;

-- Restaurants policies
CREATE POLICY "Users can view their restaurants"
  ON public.restaurants FOR SELECT
  USING (id IN (SELECT public.user_restaurants()));

CREATE POLICY "Authenticated users can create restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners and admins can update restaurants"
  ON public.restaurants FOR UPDATE
  USING (id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

CREATE POLICY "Only owners can delete restaurants"
  ON public.restaurants FOR DELETE
  USING (id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- Memberships policies
CREATE POLICY "Users can view memberships in their restaurants"
  ON public.restaurant_memberships FOR SELECT
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Owners and admins can manage memberships"
  ON public.restaurant_memberships FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Customers policies
CREATE POLICY "Staff can view customers"
  ON public.customers FOR SELECT
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can create customers"
  ON public.customers FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Admins and owners can delete customers"
  ON public.customers FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Restaurant tables policies
CREATE POLICY "Staff can view tables"
  ON public.restaurant_tables FOR SELECT
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Admins and owners can manage tables"
  ON public.restaurant_tables FOR ALL
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- Bookings policies
CREATE POLICY "Staff can view bookings"
  ON public.bookings FOR SELECT
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Staff can update bookings"
  ON public.bookings FOR UPDATE
  USING (restaurant_id IN (SELECT public.user_restaurants()));

CREATE POLICY "Admins and owners can delete bookings"
  ON public.bookings FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM public.restaurant_memberships
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));

-- ======================
-- Grants
-- ======================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings               TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_restaurants()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_booking_reference() TO authenticated;
