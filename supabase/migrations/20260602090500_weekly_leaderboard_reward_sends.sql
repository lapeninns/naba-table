create table if not exists public.weekly_leaderboard_reward_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  restaurant_id text not null,
  reward_period_start date not null,
  reward_period_end date not null,
  player_id uuid not null,
  display_name text not null,
  rank int not null check (rank between 1 and 3),
  score numeric not null,
  prize_name text not null,
  prize_code text,
  email text,
  phone text,
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'partial_failed', 'failed', 'skipped')),
  error_message text,
  valid_from date not null,
  valid_until date not null
);

create unique index if not exists weekly_leaderboard_reward_sends_rank_key
  on public.weekly_leaderboard_reward_sends (
    restaurant_id,
    reward_period_start,
    rank
  );

create unique index if not exists weekly_leaderboard_reward_sends_player_rank_key
  on public.weekly_leaderboard_reward_sends (
    restaurant_id,
    reward_period_start,
    player_id,
    rank
  );

create index if not exists weekly_leaderboard_reward_sends_status_idx
  on public.weekly_leaderboard_reward_sends (
    restaurant_id,
    reward_period_start,
    status
  );

create or replace function public.set_weekly_leaderboard_reward_sends_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists weekly_leaderboard_reward_sends_set_updated_at
  on public.weekly_leaderboard_reward_sends;

create trigger weekly_leaderboard_reward_sends_set_updated_at
before update on public.weekly_leaderboard_reward_sends
for each row
execute function public.set_weekly_leaderboard_reward_sends_updated_at();

alter table public.weekly_leaderboard_reward_sends enable row level security;

revoke all on table public.weekly_leaderboard_reward_sends from anon;
revoke all on table public.weekly_leaderboard_reward_sends from authenticated;
grant all on table public.weekly_leaderboard_reward_sends to service_role;
