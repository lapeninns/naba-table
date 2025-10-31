-- MIGRATION 20251103090200: GLOBAL CUSTOMER ENTITY SCHEMA
-- Purpose: Introduce the user_profiles table and link existing customers via user_profile_id.

BEGIN;

SET LOCAL statement_timeout = '0';

-- Ensure citext is available for case-insensitive email uniqueness.
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

-- STEP 1: Core user_profiles table (1:1 with auth.users).
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email citext UNIQUE,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_phone_e164_check CHECK (
    phone IS NULL OR phone ~ '^\\+[1-9]\\d{1,14}$'
  )
);

COMMENT ON TABLE public.user_profiles IS 'Global customer identity (1:1 with auth.users).';
COMMENT ON COLUMN public.user_profiles.phone IS 'User phone number stored in E.164 format (leading + and digits only).';

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles (phone);

-- Reuse global updated_at trigger function if present.
CREATE OR REPLACE TRIGGER set_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- STEP 2: Link customers -> user_profiles.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_profile_id
  ON public.customers (user_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_id_user_profile_id_unique
  ON public.customers (restaurant_id, user_profile_id)
  WHERE user_profile_id IS NOT NULL;

COMMENT ON COLUMN public.customers.user_profile_id IS 'Optional foreign key to global user_profiles identity.';

COMMIT;
