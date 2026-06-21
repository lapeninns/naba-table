create extension if not exists pgcrypto;

create table if not exists public.restaurant_game_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  restaurant_id text not null,
  display_name text not null check (char_length(display_name) between 2 and 40),
  email text not null,
  normalized_email text not null,
  phone text not null,
  normalized_phone text not null,
  marketing_opt_in boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_source text,
  marketing_consent_copy_version text,
  reward_delivery_consent_at timestamptz not null,
  reward_delivery_consent_source text not null,
  score integer not null check (score >= 0 and score <= 9999),
  reward_tier text check (reward_tier in ('Bronze', 'Silver', 'Gold')),
  reward_label text,
  voucher_code text unique,
  reward_send_suppressed boolean not null default false,
  email_delivery_status text not null default 'not_eligible'
    check (email_delivery_status in ('not_eligible', 'pending', 'sent', 'failed', 'skipped')),
  sms_delivery_status text not null default 'not_eligible'
    check (sms_delivery_status in ('not_eligible', 'pending', 'sent', 'failed', 'skipped')),
  email_delivery_error text,
  sms_delivery_error text,
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  contact_hash text not null,
  email_daily_hash text not null,
  phone_daily_hash text not null,
  reward_eligible_date date not null default current_date
);

create index if not exists restaurant_game_scores_public_leaderboard_idx
  on public.restaurant_game_scores (restaurant_id, score desc, created_at asc);

create index if not exists restaurant_game_scores_reward_email_daily_idx
  on public.restaurant_game_scores (restaurant_id, reward_eligible_date, email_daily_hash)
  where reward_tier is not null and reward_send_suppressed = false;

create index if not exists restaurant_game_scores_reward_phone_daily_idx
  on public.restaurant_game_scores (restaurant_id, reward_eligible_date, phone_daily_hash)
  where reward_tier is not null and reward_send_suppressed = false;

create or replace function public.set_restaurant_game_scores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurant_game_scores_set_updated_at
  on public.restaurant_game_scores;

create trigger restaurant_game_scores_set_updated_at
before update on public.restaurant_game_scores
for each row
execute function public.set_restaurant_game_scores_updated_at();

alter table public.restaurant_game_scores enable row level security;

revoke all on table public.restaurant_game_scores from anon;
revoke all on table public.restaurant_game_scores from authenticated;
grant all on table public.restaurant_game_scores to service_role;
