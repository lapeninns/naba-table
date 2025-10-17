-- Adds actual arrival/departure timestamps for bookings lifecycle events
alter table public.bookings
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz;

comment on column public.bookings.checked_in_at is 'Timestamp when the guest was checked in by ops';
comment on column public.bookings.checked_out_at is 'Timestamp when the guest was checked out by ops';
