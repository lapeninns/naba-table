-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT app_uuid(),
  event_type USER-DEFINED NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  restaurant_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  customer_id uuid,
  emitted_by text NOT NULL DEFAULT 'server'::text,
  payload jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT analytics_events_pkey PRIMARY KEY (id),
  CONSTRAINT analytics_events_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT analytics_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT analytics_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.audit_logs (
  id bigint NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
  actor text DEFAULT 'system'::text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.availability_rules (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  booking_type USER-DEFINED NOT NULL DEFAULT 'dinner'::booking_type,
  open_time time without time zone NOT NULL,
  close_time time without time zone NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT availability_rules_pkey PRIMARY KEY (id),
  CONSTRAINT availability_rules_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  table_id uuid,
  booking_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  booking_type USER-DEFINED NOT NULL DEFAULT 'dinner'::booking_type,
  seating_preference USER-DEFINED NOT NULL DEFAULT 'any'::seating_preference_type,
  status USER-DEFINED NOT NULL DEFAULT 'confirmed'::booking_status,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'web'::text,
  loyalty_points_awarded integer NOT NULL DEFAULT 0 CHECK (loyalty_points_awarded >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  reference text NOT NULL DEFAULT generate_booking_reference() UNIQUE CHECK (reference ~ '^[A-Z0-9]{10}$'::text),
  marketing_opt_in boolean NOT NULL DEFAULT false,
  auth_user_id uuid,
  client_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT bookings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT bookings_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.restaurant_tables(id),
  CONSTRAINT bookings_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.customer_profiles (
  customer_id uuid NOT NULL,
  first_booking_at timestamp with time zone,
  last_booking_at timestamp with time zone,
  total_bookings integer NOT NULL DEFAULT 0,
  total_cancellations integer NOT NULL DEFAULT 0,
  total_covers integer NOT NULL DEFAULT 0,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  last_marketing_opt_in_at timestamp with time zone,
  last_waitlist_at timestamp with time zone,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customer_profiles_pkey PRIMARY KEY (customer_id),
  CONSTRAINT customer_profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  email text NOT NULL CHECK (email::text = lower(email::text)),
  phone text NOT NULL,
  email_normalized text DEFAULT lower((email)::text),
  phone_normalized text DEFAULT regexp_replace(phone, '[^0-9]+'::text, ''::text, 'g'::text) CHECK (char_length(phone_normalized) >= 7 AND char_length(phone_normalized) <= 20),
  full_name text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT customers_restaurant_email_key UNIQUE (restaurant_id, email_normalized),
  CONSTRAINT customers_restaurant_phone_key UNIQUE (restaurant_id, phone_normalized),
  CONSTRAINT customers_restaurant_email_phone_key UNIQUE (restaurant_id, email_normalized, phone_normalized)
);
CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.loyalty_point_events (
  id uuid NOT NULL DEFAULT app_uuid(),
  program_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  booking_id uuid,
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_point_events_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_point_events_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.loyalty_programs(id),
  CONSTRAINT loyalty_point_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT loyalty_point_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.loyalty_points (
  id uuid NOT NULL DEFAULT app_uuid(),
  program_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_points integer NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  tier USER-DEFINED NOT NULL DEFAULT 'bronze'::loyalty_tier,
  last_awarded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_points_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_points_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.loyalty_programs(id),
  CONSTRAINT loyalty_points_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);
CREATE TABLE public.loyalty_programs (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  pilot_only boolean NOT NULL DEFAULT true,
  accrual_version integer NOT NULL DEFAULT 1,
  accrual_rule jsonb NOT NULL DEFAULT jsonb_build_object('type', 'per_guest', 'base_points', 10, 'points_per_guest', 5, 'minimum_party_size', 1),
  tier_definitions jsonb NOT NULL DEFAULT jsonb_build_array(jsonb_build_object('tier', 'bronze', 'min_points', 0), jsonb_build_object('tier', 'silver', 'min_points', 100), jsonb_build_object('tier', 'gold', 'min_points', 250), jsonb_build_object('tier', 'platinum', 'min_points', 500)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id),
  CONSTRAINT loyalty_programs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.observability_events (
  id uuid NOT NULL DEFAULT app_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  severity text NOT NULL CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])),
  context jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT observability_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pending_bookings (
  nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  client_request_id uuid NOT NULL,
  email text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + '00:30:00'::interval),
  CONSTRAINT pending_bookings_pkey PRIMARY KEY (nonce)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  email text,
  phone text,
  image text,
  customer_id text,
  price_id text,
  has_access boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.restaurant_areas (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  seating_type USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_areas_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_areas_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
CREATE TABLE public.restaurant_tables (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  area_id uuid,
  label text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  seating_type USER-DEFINED NOT NULL,
  features ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT restaurant_tables_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.restaurant_areas(id)
);
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT app_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  timezone text NOT NULL DEFAULT 'Europe/London'::text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  booking_id uuid,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id),
  CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.stripe_events (
  id uuid NOT NULL DEFAULT app_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  CONSTRAINT stripe_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.waiting_list (
  id uuid NOT NULL DEFAULT app_uuid(),
  restaurant_id uuid NOT NULL,
  booking_date date NOT NULL,
  desired_time time without time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  seating_preference USER-DEFINED NOT NULL DEFAULT 'any'::seating_preference_type,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  notes text,
  status USER-DEFINED NOT NULL DEFAULT 'waiting'::waiting_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waiting_list_pkey PRIMARY KEY (id),
  CONSTRAINT waiting_list_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id)
);
