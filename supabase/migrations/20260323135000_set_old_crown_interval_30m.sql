-- Keep The Old Crown Girton aligned with the 30-minute booking interval
-- already used by the new config-driven slot generation.

update public.restaurants
set
  reservation_interval_minutes = 30,
  updated_at = timezone('utc', now())
where slug = 'the-old-crown-girton'
  and deleted_at is null
  and reservation_interval_minutes is distinct from 30;
