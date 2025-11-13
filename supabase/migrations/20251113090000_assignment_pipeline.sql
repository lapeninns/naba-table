-- Assignment pipeline schema extensions

create type if not exists public.booking_assignment_state as enum (
  'created',
  'capacity_verified',
  'assignment_pending',
  'assignment_in_progress',
  'assigned',
  'confirmed',
  'failed',
  'manual_review'
);

alter table public.bookings
  add column if not exists assignment_state public.booking_assignment_state not null default 'created';

alter table public.bookings
  add column if not exists assignment_state_version integer not null default 1;

alter table public.bookings
  add column if not exists assignment_strategy text;

create table if not exists public.booking_assignment_state_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_state public.booking_assignment_state,
  to_state public.booking_assignment_state not null,
  metadata jsonb not null default '{}'::jsonb,
  reason text,
  actor_id uuid,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists booking_assignment_state_history_booking_created_idx
  on public.booking_assignment_state_history (booking_id, created_at desc);

create table if not exists public.booking_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  attempt_no integer not null,
  strategy text not null,
  result text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists booking_assignment_attempts_booking_attempt_idx
  on public.booking_assignment_attempts (booking_id, attempt_no);

create index if not exists booking_assignment_attempts_booking_created_idx
  on public.booking_assignment_attempts (booking_id, created_at desc);
