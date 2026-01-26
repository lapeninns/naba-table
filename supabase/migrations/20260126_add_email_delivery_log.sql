-- Email delivery tracking log
create table if not exists public.email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  email_type text,
  template_type text,
  recipient_email text not null,
  message_id text not null,
  status text not null,
  provider text,
  provider_event_id text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  error text,
  metadata jsonb
);

alter table public.email_delivery_log
  add constraint email_delivery_log_status_check
  check (status in (
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'failed'
  ));

alter table public.email_delivery_log
  add constraint email_delivery_log_message_recipient_status_key
  unique (message_id, recipient_email, status);

create index if not exists email_delivery_log_message_id_idx
  on public.email_delivery_log (message_id);

create index if not exists email_delivery_log_booking_id_idx
  on public.email_delivery_log (booking_id);

create index if not exists email_delivery_log_restaurant_id_idx
  on public.email_delivery_log (restaurant_id);

create index if not exists email_delivery_log_occurred_at_idx
  on public.email_delivery_log (occurred_at desc);

alter table public.email_delivery_log enable row level security;

comment on table public.email_delivery_log is 'Tracks outbound email delivery events and webhook updates.';
