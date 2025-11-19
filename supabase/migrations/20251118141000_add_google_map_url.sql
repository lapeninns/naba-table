-- Add optional Google Maps link for restaurants
alter table public.restaurants
  add column if not exists google_map_url text;
