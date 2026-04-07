create table if not exists public.restaurant_google_business_profiles (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  account_id text,
  account_name text,
  location_id text,
  location_name text,
  location_title text,
  oauth_access_token_ciphertext text not null,
  oauth_refresh_token_ciphertext text,
  oauth_access_token_expires_at timestamptz,
  oauth_token_type text,
  oauth_scopes text[] not null default '{}'::text[],
  oauth_connected_at timestamptz not null default now(),
  oauth_last_refreshed_at timestamptz,
  available_locations jsonb not null default '[]'::jsonb,
  profile_snapshot jsonb,
  profile_normalized jsonb,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_google_business_profiles_last_sync_status_check
    check (last_sync_status in ('idle', 'success', 'failed') or last_sync_status is null)
);

comment on table public.restaurant_google_business_profiles is
  'Google Business Profile OAuth connection, discovered locations, and synced profile data for each Nab a Table restaurant.';

comment on column public.restaurant_google_business_profiles.available_locations is
  'Discovered Google Business Profile account/location options accessible to the connected restaurant account.';

comment on column public.restaurant_google_business_profiles.profile_snapshot is
  'Raw Google Business Profile sync payload assembled from location, attributes, reviews, media, and performance APIs.';

comment on column public.restaurant_google_business_profiles.profile_normalized is
  'Normalized Google Business Profile data projection consumed by Nab a Table product surfaces.';

alter table public.restaurant_google_business_profiles enable row level security;
