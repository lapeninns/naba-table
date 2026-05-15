-- Allow venues to represent close times after midnight, e.g. 12:00 -> 00:00.
-- Equal open/close times remain invalid for open days.

alter table public.restaurant_operating_hours
  drop constraint if exists restaurant_operating_hours_time_order;

alter table public.restaurant_operating_hours
  add constraint restaurant_operating_hours_time_order
  check (
    is_closed
    or (
      opens_at is not null
      and closes_at is not null
      and opens_at <> closes_at
    )
  );
