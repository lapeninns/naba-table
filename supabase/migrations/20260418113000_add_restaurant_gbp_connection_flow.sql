BEGIN;

ALTER TABLE public.restaurant_external_profiles
  ADD COLUMN IF NOT EXISTS external_account_name text,
  ADD COLUMN IF NOT EXISTS external_location_name text,
  ADD COLUMN IF NOT EXISTS external_location_title text;

ALTER TABLE public.restaurant_external_profiles
  DROP CONSTRAINT IF EXISTS restaurant_external_profiles_status_check;

ALTER TABLE public.restaurant_external_profiles
  ADD CONSTRAINT restaurant_external_profiles_status_check
    CHECK (
      connection_status IN (
        'pending_auth',
        'authorized',
        'linked',
        'unlinked',
        'reauth_required',
        'sync_error'
      )
    );

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_credentials (
  external_profile_id uuid PRIMARY KEY REFERENCES public.restaurant_external_profiles(id) ON DELETE CASCADE,
  provider_user_id text,
  connected_google_email text,
  connected_google_name text,
  access_token_encrypted text,
  refresh_token_encrypted text NOT NULL,
  access_token_expires_at timestamptz,
  granted_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  token_type text,
  last_refreshed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.restaurant_external_profile_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  requested_by_user_id uuid NOT NULL,
  state_token text NOT NULL,
  return_path text NOT NULL DEFAULT '/settings/restaurant/google-business-profile',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT restaurant_external_profile_oauth_states_provider_check
    CHECK (provider IN ('google_business_profile')),
  CONSTRAINT restaurant_external_profile_oauth_states_state_token_unique
    UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_credentials_email_idx
  ON public.restaurant_external_profile_credentials (connected_google_email);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_oauth_states_restaurant_idx
  ON public.restaurant_external_profile_oauth_states (restaurant_id, provider, expires_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_external_profile_oauth_states_active_idx
  ON public.restaurant_external_profile_oauth_states (state_token, expires_at DESC)
  WHERE consumed_at IS NULL;

DROP TRIGGER IF EXISTS restaurant_external_profile_credentials_updated_at
ON public.restaurant_external_profile_credentials;

CREATE TRIGGER restaurant_external_profile_credentials_updated_at
  BEFORE UPDATE ON public.restaurant_external_profile_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

DROP TRIGGER IF EXISTS restaurant_external_profile_oauth_states_updated_at
ON public.restaurant_external_profile_oauth_states;

CREATE TRIGGER restaurant_external_profile_oauth_states_updated_at
  BEFORE UPDATE ON public.restaurant_external_profile_oauth_states
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_restaurant_business_entity_updated_at();

ALTER TABLE public.restaurant_external_profile_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_external_profile_oauth_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_credentials'
      AND policyname = 'Service role can manage restaurant external profile credentials'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile credentials"
      ON public.restaurant_external_profile_credentials
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_external_profile_oauth_states'
      AND policyname = 'Service role can manage restaurant external profile oauth states'
  ) THEN
    CREATE POLICY "Service role can manage restaurant external profile oauth states"
      ON public.restaurant_external_profile_oauth_states
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

COMMIT;
