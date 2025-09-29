-- ====================================================================
-- Booking Engine — Complete Production Schema (Postgres/Supabase)
-- Includes: Base schema, multi-tenant hardening, DB-driven auth, 
--           booking versions, and all performance indexes
-- Safe to re-run (fully idempotent)
-- ====================================================================

-- =========================
-- Extensions
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================
-- Helper functions & types
-- =========================

-- UUID helper with fallbacks
CREATE OR REPLACE FUNCTION public.app_uuid()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v uuid;
BEGIN
  BEGIN
    SELECT gen_random_uuid() INTO v;
    RETURN v;
  EXCEPTION WHEN undefined_function THEN
    BEGIN
      SELECT uuid_generate_v4() INTO v;
      RETURN v;
    EXCEPTION WHEN undefined_function THEN
      RETURN (
        lpad(to_hex((random()*4294967295)::bigint), 8, '0') || '-' ||
        lpad(to_hex((random()*65535)::int), 4, '0') || '-' ||
        '4' || substr(lpad(to_hex((random()*65535)::int), 4, '0'), 2) || '-' ||
        to_hex(8 + (random()*3)::int) ||
        substr(lpad(to_hex((random()*65535)::int), 4, '0'), 2) || '-' ||
        lpad(to_hex((random()*4294967295)::bigint), 8, '0') ||
        lpad(to_hex((random()*65535)::int), 4, '0')
      )::uuid;
    END;
  END;
END;
$$;

-- Random booking reference (10 chars)
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  ref   text := '';
  i     int;
BEGIN
  FOR i IN 1..10 LOOP
    ref := ref || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN ref;
END;
$$;

-- Email domain (idempotent)
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'email_address' AND n.nspname = 'public'
  ) THEN
    CREATE DOMAIN public.email_address AS text
      CHECK (VALUE ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
  END IF;
END
$blk$;

-- Enums
DO $blk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
    CREATE TYPE public.booking_status AS ENUM ('confirmed','cancelled','pending','pending_allocation');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_type') THEN
    CREATE TYPE public.booking_type AS ENUM ('breakfast','lunch','dinner','drinks');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seating_preference_type') THEN
    CREATE TYPE public.seating_preference_type AS ENUM ('any','indoor','window','booth','bar','outdoor');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_tier') THEN
    CREATE TYPE public.loyalty_tier AS ENUM ('bronze','silver','gold','platinum');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waiting_status') THEN
    CREATE TYPE public.waiting_status AS ENUM ('waiting','notified','expired','fulfilled','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analytics_event_type') THEN
    CREATE TYPE public.analytics_event_type AS ENUM ('booking.created','booking.cancelled','booking.allocated','booking.waitlisted');
  END IF;
END
$blk$;

-- Sequences
CREATE SEQUENCE IF NOT EXISTS public.audit_logs_id_seq START WITH 1 INCREMENT BY 1 OWNED BY NONE;

-- =========================
-- Core tables
-- =========================

CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text NOT NULL DEFAULT 'Europe/London',
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_areas (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  seating_type public.seating_preference_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.restaurant_areas(id) ON DELETE SET NULL,
  label text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  seating_type public.seating_preference_type NOT NULL,
  features text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_restaurant_label_uidx
  ON public.restaurant_tables (restaurant_id, lower(label));

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email public.email_address NOT NULL,
  phone text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(email::text)) STORED,
  phone_normalized text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]+', '', 'g')) STORED,
  full_name text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_email_lower CHECK (email = lower(email::text)),
  CONSTRAINT customers_phone_length CHECK (char_length(phone_normalized) BETWEEN 7 AND 20),
  CONSTRAINT customers_restaurant_contact_uidx UNIQUE (restaurant_id, email_normalized, phone_normalized)
);

CREATE INDEX IF NOT EXISTS customers_restaurant_email_idx
  ON public.customers (restaurant_id, email_normalized);

CREATE INDEX IF NOT EXISTS customers_restaurant_created_idx
  ON public.customers (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_auth_user_uidx
  ON public.customers (restaurant_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_auth_user_idx
  ON public.customers (auth_user_id);

CREATE INDEX IF NOT EXISTS customers_email_global_idx
  ON public.customers (email_normalized);

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  total_bookings integer NOT NULL DEFAULT 0,
  total_cancellations integer NOT NULL DEFAULT 0,
  total_covers integer NOT NULL DEFAULT 0,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  last_marketing_opt_in_at timestamptz,
  last_waitlist_at timestamptz,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  slot tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
  party_size integer NOT NULL CHECK (party_size > 0),
  booking_type public.booking_type NOT NULL DEFAULT 'dinner',
  seating_preference public.seating_preference_type NOT NULL DEFAULT 'any',
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  customer_name text NOT NULL,
  customer_email public.email_address NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'web',
  loyalty_points_awarded integer NOT NULL DEFAULT 0 CHECK (loyalty_points_awarded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reference text NOT NULL DEFAULT public.generate_booking_reference()
    UNIQUE CHECK (reference ~ '^[A-Z0-9]{10}$'),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_request_id uuid NOT NULL,
  pending_ref uuid,
  idempotency_key text,
  details jsonb,
  CONSTRAINT bookings_time_order CHECK (end_at > start_at),
  CONSTRAINT bookings_customer_email_lower CHECK (customer_email = lower(customer_email::text))
);

-- Backfill email normalization if needed
UPDATE public.bookings
SET customer_email = lower(customer_email::text)
WHERE customer_email <> lower(customer_email::text);

-- Exclusion constraint (no overlaps per table)
DO $blk$
BEGIN
  -- Drop existing constraint if it exists with wrong settings
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_no_overlap'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_no_overlap;
  END IF;

  -- Create constraint with INITIALLY DEFERRED to allow updates
  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (
      table_id WITH =,
      slot WITH &&
    )
    WHERE (status IN ('confirmed','pending','pending_allocation'))
    DEFERRABLE INITIALLY DEFERRED;
END
$blk$;

-- Core booking indexes
CREATE INDEX IF NOT EXISTS bookings_table_date_start_idx
  ON public.bookings (table_id, booking_date, start_time)
  INCLUDE (end_time, status, party_size, seating_preference, id);

CREATE INDEX IF NOT EXISTS bookings_restaurant_date_start_idx
  ON public.bookings (restaurant_id, booking_date, start_time)
  INCLUDE (end_time, status, party_size, seating_preference, id);

CREATE INDEX IF NOT EXISTS bookings_idempotency_key_idx
  ON public.bookings (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_idem_unique_per_restaurant
  ON public.bookings (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_client_request_id_idx
  ON public.bookings (client_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_client_request_unique
  ON public.bookings (restaurant_id, client_request_id);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_pending_ref_key
  ON public.bookings (pending_ref);



CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_restaurant_idx
  ON public.reviews (restaurant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_uidx
  ON public.reviews (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.availability_rules (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  booking_type public.booking_type NOT NULL DEFAULT 'dinner',
  open_time time NOT NULL,
  close_time time NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_rules_time_order CHECK (close_time > open_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS availability_rules_nodup_uidx
  ON public.availability_rules (restaurant_id, day_of_week, booking_type);

CREATE TABLE IF NOT EXISTS public.waiting_list (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  desired_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  seating_preference public.seating_preference_type NOT NULL DEFAULT 'any',
  customer_name text NOT NULL,
  customer_email public.email_address NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  status public.waiting_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waiting_list_restaurant_date_idx
  ON public.waiting_list (restaurant_id, booking_date, desired_time);

CREATE UNIQUE INDEX IF NOT EXISTS waiting_list_contact_dedupe_uidx
  ON public.waiting_list (
    restaurant_id,
    booking_date,
    desired_time,
    lower(customer_email::text),
    regexp_replace(customer_phone, '[^0-9]+', '', 'g')
  )
  WHERE status IN ('waiting','notified');

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  pilot_only boolean NOT NULL DEFAULT true,
  accrual_version integer NOT NULL DEFAULT 1,
  accrual_rule jsonb NOT NULL DEFAULT jsonb_build_object(
    'type','per_guest','base_points',10,'points_per_guest',5,'minimum_party_size',1
  ),
  tier_definitions jsonb NOT NULL DEFAULT jsonb_build_array(
    jsonb_build_object('tier','bronze','min_points',0),
    jsonb_build_object('tier','silver','min_points',100),
    jsonb_build_object('tier','gold','min_points',250),
    jsonb_build_object('tier','platinum','min_points',500)
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_programs_restaurant_slug_idx UNIQUE (restaurant_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_programs_active_program_idx
  ON public.loyalty_programs (restaurant_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_points integer NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  tier public.loyalty_tier NOT NULL DEFAULT 'bronze',
  last_awarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_points_program_customer_key UNIQUE (program_id, customer_id)
);

-- Backfill restaurant_id if needed
UPDATE public.loyalty_points lp
SET restaurant_id = p.restaurant_id
FROM public.loyalty_programs p
WHERE lp.restaurant_id IS NULL AND lp.program_id = p.id;

ALTER TABLE public.loyalty_points
  ALTER COLUMN restaurant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS loyalty_points_customer_idx
  ON public.loyalty_points (customer_id, program_id);

CREATE INDEX IF NOT EXISTS loyalty_points_program_idx
  ON public.loyalty_points (program_id);

CREATE INDEX IF NOT EXISTS loyalty_points_restaurant_idx
  ON public.loyalty_points (restaurant_id);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_points_prog_customer_uidx
  ON public.loyalty_points (program_id, customer_id);

CREATE TABLE IF NOT EXISTS public.loyalty_point_events (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill restaurant_id if needed
UPDATE public.loyalty_point_events lpe
SET restaurant_id = p.restaurant_id
FROM public.loyalty_programs p
WHERE lpe.restaurant_id IS NULL AND lpe.program_id = p.id;

ALTER TABLE public.loyalty_point_events
  ALTER COLUMN restaurant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS loyalty_point_events_customer_idx
  ON public.loyalty_point_events (customer_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_booking_reason_idx
  ON public.loyalty_point_events (booking_id, reason)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS loyalty_point_events_program_idx
  ON public.loyalty_point_events (program_id);

CREATE INDEX IF NOT EXISTS loyalty_point_events_restaurant_idx
  ON public.loyalty_point_events (restaurant_id);

CREATE INDEX IF NOT EXISTS loyalty_point_events_booking_idx
  ON public.loyalty_point_events (booking_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigint PRIMARY KEY DEFAULT nextval('public.audit_logs_id_seq'::regclass),
  actor text DEFAULT 'system',
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS stripe_events_received_idx
  ON public.stripe_events (received_at DESC);

CREATE TABLE IF NOT EXISTS public.observability_events (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS observability_events_type_idx
  ON public.observability_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT public.app_uuid(),
  event_type public.analytics_event_type NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  emitted_by text NOT NULL DEFAULT 'server',
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_version_match CHECK ((payload ->> 'version')::integer = schema_version),
  CONSTRAINT analytics_events_booking_match CHECK ((payload ->> 'booking_id')::uuid = booking_id),
  CONSTRAINT analytics_events_restaurant_match CHECK ((payload ->> 'restaurant_id')::uuid = restaurant_id),
  CONSTRAINT analytics_events_payload_shape CHECK (
    CASE event_type
      WHEN 'booking.created' THEN
        payload ?& ARRAY['version','booking_id','restaurant_id','customer_id','status','party_size','booking_type','seating_preference','source','waitlisted']
        AND jsonb_typeof(payload -> 'party_size') = 'number'
        AND jsonb_typeof(payload -> 'waitlisted') = 'boolean'
      WHEN 'booking.cancelled' THEN
        payload ?& ARRAY['version','booking_id','restaurant_id','customer_id','previous_status','cancelled_by']
      WHEN 'booking.allocated' THEN
        payload ?& ARRAY['version','booking_id','restaurant_id','customer_id','table_id','allocation_status']
      WHEN 'booking.waitlisted' THEN
        payload ?& ARRAY['version','booking_id','restaurant_id','customer_id','waitlist_id','position']
        AND jsonb_typeof(payload -> 'position') = 'number'
      ELSE false
    END
  )
);

CREATE INDEX IF NOT EXISTS analytics_events_type_ts_idx
  ON public.analytics_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_restaurant_idx
  ON public.analytics_events (restaurant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_booking_idx
  ON public.analytics_events (booking_id);

-- =========================
-- Support tables
-- =========================

CREATE TABLE IF NOT EXISTS public.booking_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email_normalized text NOT NULL CHECK (email_normalized = lower(email_normalized)),
  phone_normalized text CHECK (phone_normalized IS NULL OR char_length(phone_normalized) BETWEEN 7 AND 20),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_drafts_restaurant_idx
  ON public.booking_drafts (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_drafts_expires_idx
  ON public.booking_drafts (expires_at);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email public.email_address,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.pending_bookings (
  nonce uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_request_id uuid NOT NULL,
  email public.email_address NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS pending_bookings_client_req_idx
  ON public.pending_bookings (client_request_id);

CREATE INDEX IF NOT EXISTS pending_bookings_expires_idx
  ON public.pending_bookings (expires_at);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  name text,
  email public.email_address,
  image text,
  customer_id text,
  price_id text,
  has_access boolean DEFAULT false,
  created_at timestamptz DEFAULT (now() AT TIME ZONE 'UTC'),
  updated_at timestamptz DEFAULT (now() AT TIME ZONE 'UTC'),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =========================
-- Multi-tenant auth: Membership table
-- =========================

CREATE TABLE IF NOT EXISTS public.restaurant_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','staff','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS restaurant_memberships_restaurant_idx
  ON public.restaurant_memberships (restaurant_id, user_id);

CREATE INDEX IF NOT EXISTS restaurant_memberships_user_idx
  ON public.restaurant_memberships (user_id, restaurant_id);

-- =========================
-- Booking versions (append-only history)
-- =========================

CREATE TABLE IF NOT EXISTS public.booking_versions (
  version_id     BIGSERIAL PRIMARY KEY,
  booking_id     uuid NOT NULL,
  restaurant_id  uuid NOT NULL,
  change_type    text NOT NULL CHECK (change_type IN ('created','updated','cancelled')),
  changed_by     uuid,
  changed_at     timestamptz NOT NULL DEFAULT now(),
  old_data       jsonb,
  new_data       jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS booking_versions_booking_idx
  ON public.booking_versions (booking_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS booking_versions_tenant_idx
  ON public.booking_versions (restaurant_id, changed_at DESC);

-- =========================
-- Multi-tenant hardening: Composite indexes & FKs
-- =========================

-- Composite uniqueness for same-restaurant FKs
CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_id_uidx
  ON public.customers (restaurant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_restaurant_id_uidx
  ON public.restaurant_tables (restaurant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_areas_restaurant_id_uidx
  ON public.restaurant_areas (restaurant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_programs_restaurant_id_uidx
  ON public.loyalty_programs (restaurant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_areas_restaurant_name_uidx
  ON public.restaurant_areas (restaurant_id, lower(name));

-- Composite FKs for same-restaurant enforcement
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bookings_customer_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, customer_id)
      REFERENCES public.customers (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bookings_table_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_table_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, table_id)
      REFERENCES public.restaurant_tables (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='restaurant_tables_area_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.restaurant_tables
      ADD CONSTRAINT restaurant_tables_area_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, area_id)
      REFERENCES public.restaurant_areas (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='loyalty_points_program_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.loyalty_points
      ADD CONSTRAINT loyalty_points_program_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, program_id)
      REFERENCES public.loyalty_programs (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='loyalty_points_customer_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.loyalty_points
      ADD CONSTRAINT loyalty_points_customer_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, customer_id)
      REFERENCES public.customers (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='loyalty_point_events_program_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.loyalty_point_events
      ADD CONSTRAINT loyalty_point_events_program_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, program_id)
      REFERENCES public.loyalty_programs (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='loyalty_point_events_customer_same_restaurant_fkey'
  ) THEN
    ALTER TABLE public.loyalty_point_events
      ADD CONSTRAINT loyalty_point_events_customer_same_restaurant_fkey
      FOREIGN KEY (restaurant_id, customer_id)
      REFERENCES public.customers (restaurant_id, id)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bookings_pending_ref_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_pending_ref_fkey
      FOREIGN KEY (pending_ref) REFERENCES public.pending_bookings(nonce)
      ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END
$blk$;

-- FK performance indexes
CREATE INDEX IF NOT EXISTS restaurant_areas_restaurant_idx
  ON public.restaurant_areas (restaurant_id);

CREATE INDEX IF NOT EXISTS restaurant_tables_restaurant_idx
  ON public.restaurant_tables (restaurant_id);

CREATE INDEX IF NOT EXISTS restaurant_tables_area_idx
  ON public.restaurant_tables (area_id);

-- =========================
-- Triggers
-- =========================

-- Generic updated_at touch trigger
CREATE OR REPLACE FUNCTION public.tg__touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$func$;

-- Attach touch triggers (re-create each one to be safe)
DO $blk$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'restaurants','restaurant_areas','restaurant_tables','customers',
    'customer_profiles','bookings','waiting_list','loyalty_points',
    'loyalty_programs','booking_drafts'
  ]
  LOOP
    -- trigger names are per-table, so it's simplest to drop+create
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;',
                   'touch_updated_at_'||t, t);

    EXECUTE format(
      'CREATE TRIGGER %I
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.tg__touch_updated_at();',
      'touch_updated_at_'||t, t
    );
  END LOOP;
END
$blk$;


-- Bookings: compute start_at/end_at from date/time + timezone
CREATE OR REPLACE FUNCTION public.tg__bookings_compute_times()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
DECLARE
  tz text;
BEGIN
  SELECT COALESCE(r."timezone", 'UTC') INTO tz
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  IF TG_OP = 'INSERT'
     OR NEW.start_at IS NULL OR NEW.end_at IS NULL
     OR (OLD.booking_date IS DISTINCT FROM NEW.booking_date)
     OR (OLD.start_time  IS DISTINCT FROM NEW.start_time)
     OR (OLD.end_time    IS DISTINCT FROM NEW.end_time)
     OR (OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id)
  THEN
    NEW.start_at := make_timestamptz(
      EXTRACT(YEAR  FROM NEW.booking_date)::int,
      EXTRACT(MONTH FROM NEW.booking_date)::int,
      EXTRACT(DAY   FROM NEW.booking_date)::int,
      EXTRACT(HOUR  FROM NEW.start_time)::int,
      EXTRACT(MINUTE FROM NEW.start_time)::int,
      0, tz
    );

    NEW.end_at := make_timestamptz(
      EXTRACT(YEAR  FROM NEW.booking_date)::int,
      EXTRACT(MONTH FROM NEW.booking_date)::int,
      EXTRACT(DAY   FROM NEW.booking_date)::int,
      EXTRACT(HOUR  FROM NEW.end_time)::int,
      EXTRACT(MINUTE FROM NEW.end_time)::int,
      0, tz
    );

    IF NEW.end_at <= NEW.start_at THEN
      NEW.end_at := NEW.end_at + interval '1 day';
    END IF;
  END IF;

  RETURN NEW;
END
$func$;

-- Attach trigger (idempotent)
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_booking_times'
  ) THEN
    CREATE TRIGGER set_booking_times
      BEFORE INSERT OR UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.tg__bookings_compute_times();
  END IF;
END
$blk$;


-- Booking versions trigger
CREATE OR REPLACE FUNCTION public.tg__bookings_write_version()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
DECLARE
  v_change text;
  actor uuid;
BEGIN
  actor := auth.uid(); -- ok in Supabase; NULL if no authenticated user

  IF TG_OP = 'INSERT' THEN
    v_change := 'created';

    INSERT INTO public.booking_versions
      (booking_id, restaurant_id, change_type, changed_by, old_data, new_data)
    VALUES
      (NEW.id, NEW.restaurant_id, v_change, actor, NULL, to_jsonb(NEW));

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'cancelled'::public.booking_status
    THEN
      v_change := 'cancelled';
    ELSE
      v_change := 'updated';
    END IF;

    INSERT INTO public.booking_versions
      (booking_id, restaurant_id, change_type, changed_by, old_data, new_data)
    VALUES
      (NEW.id, NEW.restaurant_id, v_change, actor, to_jsonb(OLD), to_jsonb(NEW));

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_change := 'deleted';

    INSERT INTO public.booking_versions
      (booking_id, restaurant_id, change_type, changed_by, old_data, new_data)
    VALUES
      (OLD.id, OLD.restaurant_id, v_change, actor, to_jsonb(OLD), NULL);

    RETURN OLD;
  END IF;

  -- Fallback (AFTER triggers ignore return value, but keep it tidy)
  RETURN COALESCE(NEW, OLD);
END
$func$;

-- Attach trigger (idempotent)
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'bookings_write_version'
  ) THEN
    CREATE TRIGGER bookings_write_version
      AFTER INSERT OR UPDATE OR DELETE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.tg__bookings_write_version();
  END IF;
END
$blk$;


DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'bookings_write_version'
  ) THEN
    CREATE TRIGGER bookings_write_version
      AFTER INSERT OR UPDATE ON public.bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.tg__bookings_write_version();
  END IF;
END
$blk$;

-- =========================
-- Views
-- =========================

-- Current bookings (active statuses only)
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname='public' AND viewname='current_bookings'
  ) THEN
    CREATE VIEW public.current_bookings AS
      SELECT *
      FROM public.bookings
      WHERE status IN ('confirmed','pending','pending_allocation');
  END IF;
END
$blk$;

-- =========================
-- Auth helpers
-- =========================

-- DB-driven tenant check (uses restaurant_memberships)
CREATE OR REPLACE FUNCTION public.tenant_permitted(tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN true
    WHEN $1 IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.restaurant_memberships m
      WHERE m.restaurant_id = $1
        AND m.user_id = auth.uid()
    )
  END;
$fn$;

-- Role hierarchy helper
CREATE OR REPLACE FUNCTION public.has_role(tenant uuid, need text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  WITH me AS (
    SELECT m.role
    FROM public.restaurant_memberships m
    WHERE m.restaurant_id = $1
      AND m.user_id = auth.uid()
    LIMIT 1
  )
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN true
    WHEN $1 IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM me) THEN false
    ELSE EXISTS (
      SELECT 1
      FROM me
      WHERE ($2 = 'viewer' AND me.role IN ('viewer','staff','admin','owner'))
         OR ($2 = 'staff'  AND me.role IN ('staff','admin','owner'))
         OR ($2 = 'admin'  AND me.role IN ('admin','owner'))
         OR ($2 = 'owner'  AND me.role  = 'owner')
    )
  END;
$fn$;


-- =========================
-- Row Level Security
-- =========================

-- Enable RLS on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_versions ENABLE ROW LEVEL SECURITY;

-- =========================
-- Service role policies (full access)
-- =========================

DO $blk$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'restaurants','restaurant_areas','restaurant_tables','bookings','customers',
      'customer_profiles','reviews','availability_rules','waiting_list',
      'loyalty_programs','loyalty_points','loyalty_point_events','audit_logs',
      'stripe_events','observability_events','analytics_events','booking_drafts',
      'pending_bookings','leads','profiles','restaurant_memberships','booking_versions'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname=('Service role full access '||t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (auth.role() = %L) WITH CHECK (auth.role() = %L);',
        'Service role full access '||t, t, 'service_role', 'service_role'
      );
    END IF;
  END LOOP;
END
$blk$;

-- =========================
-- Public read policies (catalog tables)
-- =========================


-- =========================
-- Public read policies (catalog tables)
-- =========================

DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurants' AND policyname='Public read restaurants'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Public read restaurants" ON public.restaurants FOR SELECT USING (true);$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_areas' AND policyname='Public read restaurant_areas'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Public read restaurant_areas" ON public.restaurant_areas FOR SELECT USING (true);$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='Public read restaurant_tables'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Public read restaurant_tables" ON public.restaurant_tables FOR SELECT USING (true);$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='availability_rules' AND policyname='Public read availability_rules'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Public read availability_rules" ON public.availability_rules FOR SELECT USING (true);$sql$;
  END IF;
END
$blk$;

-- =========================
-- Tenant read policies
-- =========================

DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='bookings' AND policyname='Tenant read bookings'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read bookings" ON public.bookings
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customers' AND policyname='Tenant read customers'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read customers" ON public.customers
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='customer_profiles' AND policyname='Tenant read customer_profiles'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Tenant read customer_profiles" ON public.customer_profiles
      FOR SELECT TO authenticated
      USING (
        public.tenant_permitted(
          (SELECT restaurant_id FROM public.customers c WHERE c.id = customer_profiles.customer_id)
        )
      );$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews' AND policyname='Tenant read reviews'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read reviews" ON public.reviews
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_programs' AND policyname='Tenant read loyalty_programs'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read loyalty_programs" ON public.loyalty_programs
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_points' AND policyname='Tenant read loyalty_points'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read loyalty_points" ON public.loyalty_points
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_point_events' AND policyname='Tenant read loyalty_point_events'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read loyalty_point_events" ON public.loyalty_point_events
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='analytics_events' AND policyname='Tenant read analytics_events'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read analytics_events" ON public.analytics_events
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='audit_logs' AND policyname='Tenant read audit_logs'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Tenant read audit_logs" ON public.audit_logs
      FOR SELECT TO authenticated
      USING (
        CASE
          WHEN coalesce(metadata, '{}'::jsonb) ? 'restaurant_id' THEN
            CASE
              WHEN coalesce(metadata, '{}'::jsonb) ->> 'restaurant_id'
                   ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN public.tenant_permitted((metadata ->> 'restaurant_id')::uuid)
              WHEN coalesce(metadata, '{}'::jsonb) ->> 'restaurant_id' = '' THEN true
              ELSE false
            END
          ELSE true
        END
      );$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='waiting_list' AND policyname='Tenant read waiting_list'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read waiting_list" ON public.waiting_list
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='booking_drafts' AND policyname='Tenant read booking_drafts'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read booking_drafts" ON public.booking_drafts
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='booking_versions' AND policyname='Tenant read booking_versions'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant read booking_versions" ON public.booking_versions
      FOR SELECT TO authenticated USING (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_memberships' AND policyname='Users read own memberships'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Users read own memberships" ON public.restaurant_memberships
      FOR SELECT TO authenticated USING (user_id = auth.uid());$sql$;
  END IF;
END
$blk$;

-- =========================
-- Tenant write policies
-- =========================

DO $blk$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'restaurant_areas','restaurant_tables','customers','bookings',
      'reviews','availability_rules','waiting_list','loyalty_programs',
      'booking_drafts','analytics_events'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname=('Tenant insert '||t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (public.tenant_permitted(restaurant_id));',
        'Tenant insert '||t, t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND policyname=('Tenant update '||t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.tenant_permitted(restaurant_id))
         WITH CHECK (public.tenant_permitted(restaurant_id));',
        'Tenant update '||t, t
      );
    END IF;
  END LOOP;

  -- Loyalty tables with explicit restaurant_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_points' AND policyname='Tenant insert loyalty_points'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant insert loyalty_points" ON public.loyalty_points
      FOR INSERT TO authenticated WITH CHECK (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_points' AND policyname='Tenant update loyalty_points'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant update loyalty_points" ON public.loyalty_points
      FOR UPDATE TO authenticated
      USING (public.tenant_permitted(restaurant_id))
      WITH CHECK (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_point_events' AND policyname='Tenant insert loyalty_point_events'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant insert loyalty_point_events" ON public.loyalty_point_events
      FOR INSERT TO authenticated WITH CHECK (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='loyalty_point_events' AND policyname='Tenant update loyalty_point_events'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Tenant update loyalty_point_events" ON public.loyalty_point_events
      FOR UPDATE TO authenticated
      USING (public.tenant_permitted(restaurant_id))
      WITH CHECK (public.tenant_permitted(restaurant_id));$sql$;
  END IF;

  -- Membership write policies (admin+ can manage)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_memberships' AND policyname='Admins manage memberships'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Admins manage memberships" ON public.restaurant_memberships
      FOR INSERT TO authenticated WITH CHECK (public.has_role(restaurant_id, 'admin'));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_memberships' AND policyname='Admins update memberships'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Admins update memberships" ON public.restaurant_memberships
      FOR UPDATE TO authenticated
      USING (public.has_role(restaurant_id, 'admin'))
      WITH CHECK (public.has_role(restaurant_id, 'admin'));$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restaurant_memberships' AND policyname='Admins delete memberships'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Admins delete memberships" ON public.restaurant_memberships
      FOR DELETE TO authenticated USING (public.has_role(restaurant_id, 'admin'));$sql$;
  END IF;
END
$blk$;

-- =========================
-- Profile policies
-- =========================

DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Users read own profile'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Users read own profile" ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id);$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Users insert own profile'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Users insert own profile" ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);$sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Users update own profile'
  ) THEN
    EXECUTE $sql$CREATE POLICY "Users update own profile" ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);$sql$;
  END IF;
END
$blk$;

-- =========================
-- Revoke DELETE on bookings (non-destructive pattern)
-- =========================

DO $blk$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'bookings'
      AND privilege_type = 'DELETE'
  ) THEN
    EXECUTE $$REVOKE DELETE ON TABLE public.bookings FROM authenticated;$$;
  END IF;
END
$blk$;

-- =========================
-- Grants
-- =========================

GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;
GRANT USAGE ON SCHEMA auth   TO service_role, authenticated, anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON TABLE public.current_bookings TO authenticated, anon;

GRANT INSERT ON TABLE public.booking_versions TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.tenant_permitted(uuid)             TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text)                TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.app_uuid()                          TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_booking_reference()        TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tg__touch_updated_at()              TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tg__bookings_compute_times()        TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.tg__bookings_write_version()        TO authenticated, anon, service_role;


-- Customer lookup indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_customer_email_start_idx
  ON public.bookings (lower(customer_email::text), start_at DESC)
  INCLUDE (restaurant_id, status, party_size, end_at, customer_id, notes);

CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_customer_id_start_idx
  ON public.bookings (customer_id, start_at DESC)
  INCLUDE (restaurant_id, status, party_size, customer_email, end_at);