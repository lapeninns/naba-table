alter table public.restaurant_operating_hours
  add column if not exists reservation_interval_minutes integer,
  add column if not exists reservation_slot_times text[];

comment on column public.restaurant_operating_hours.reservation_interval_minutes is
  'Optional per-day reservation interval override (minutes).';
comment on column public.restaurant_operating_hours.reservation_slot_times is
  'Optional fixed reservation slot times (HH:MM) for the day; overrides interval when set.';

notify pgrst, 'reload schema';
