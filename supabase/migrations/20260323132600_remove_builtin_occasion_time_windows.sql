-- Built-in lunch/dinner timing should come from restaurant service periods and
-- operating hours, not from global occasion-level time windows.

update public.booking_occasions
set
  availability = '[]'::jsonb,
  updated_at = timezone('utc', now())
where key in ('lunch', 'dinner')
  and deleted_at is null;
