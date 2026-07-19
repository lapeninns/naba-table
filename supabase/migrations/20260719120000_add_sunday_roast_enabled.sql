alter table public.restaurants
  add column if not exists sunday_roast_enabled boolean not null default false;

comment on column public.restaurants.sunday_roast_enabled is
  'When enabled, guests can mark Sunday reservations as Sunday Roast bookings.';
