alter table public.restaurant_game_scores
  drop constraint if exists restaurant_game_scores_voucher_code_key;

alter table public.restaurant_game_scores
  add column if not exists reward_period_start date,
  add column if not exists reward_valid_until date,
  add column if not exists email_weekly_hash text,
  add column if not exists phone_weekly_hash text,
  add column if not exists facebook_share_url text,
  add column if not exists reward_share_copy_version text;

update public.restaurant_game_scores
set
  reward_period_start = coalesce(reward_period_start, reward_eligible_date),
  reward_valid_until = coalesce(reward_valid_until, reward_eligible_date + 6),
  email_weekly_hash = coalesce(email_weekly_hash, email_daily_hash),
  phone_weekly_hash = coalesce(phone_weekly_hash, phone_daily_hash)
where
  reward_period_start is null
  or reward_valid_until is null
  or email_weekly_hash is null
  or phone_weekly_hash is null;

alter table public.restaurant_game_scores
  alter column reward_period_start set default current_date,
  alter column reward_valid_until set default current_date + 6;

create index if not exists restaurant_game_scores_weekly_leaderboard_idx
  on public.restaurant_game_scores (
    restaurant_id,
    reward_period_start,
    score desc,
    created_at asc
  );

create index if not exists restaurant_game_scores_reward_email_weekly_idx
  on public.restaurant_game_scores (
    restaurant_id,
    reward_period_start,
    email_weekly_hash
  )
  where reward_tier is not null and reward_send_suppressed = false;

create index if not exists restaurant_game_scores_reward_phone_weekly_idx
  on public.restaurant_game_scores (
    restaurant_id,
    reward_period_start,
    phone_weekly_hash
  )
  where reward_tier is not null and reward_send_suppressed = false;
