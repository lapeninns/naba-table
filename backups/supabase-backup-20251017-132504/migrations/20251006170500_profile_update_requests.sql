-- Adds idempotency tracking for profile updates

create table if not exists public.profile_update_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  payload_hash text not null,
  applied_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profile_update_requests_profile_key_idx
  on public.profile_update_requests (profile_id, idempotency_key);
