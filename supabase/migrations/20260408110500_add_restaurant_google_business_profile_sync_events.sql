create table if not exists public.restaurant_google_business_profile_sync_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  account_id text,
  account_name text,
  location_id text,
  location_name text,
  location_title text,
  trigger_source text not null default 'manual',
  sync_started_at timestamptz not null default now(),
  sync_completed_at timestamptz,
  sync_status text not null,
  sync_error text,
  sync_families jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint restaurant_google_business_profile_sync_events_trigger_source_check
    check (trigger_source in ('manual')),
  constraint restaurant_google_business_profile_sync_events_sync_status_check
    check (sync_status in ('success', 'partial', 'failed'))
);

create index if not exists idx_restaurant_google_business_profile_sync_events_restaurant_started_at
  on public.restaurant_google_business_profile_sync_events (restaurant_id, sync_started_at desc);

comment on table public.restaurant_google_business_profile_sync_events is
  'Operational history of Google Business Profile manual sync attempts for each Nab a Table restaurant.';

comment on column public.restaurant_google_business_profile_sync_events.sync_families is
  'Per-family sync diagnostics captured for this run.';

alter table public.restaurant_google_business_profile_sync_events enable row level security;
