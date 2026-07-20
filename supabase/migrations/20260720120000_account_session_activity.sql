-- Account device and session activity.
--
-- Supabase Auth keeps the authoritative active-session records in auth.sessions.
-- This public ledger stores a user-scoped, non-secret snapshot so people can see
-- when their own sessions were created and last used, including after sign-out.

create table if not exists public.account_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  nickname text,
  time_zone text,
  locale text,
  city text,
  region text,
  country_code text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint account_devices_nickname_check
    check (nickname is null or (nickname = btrim(nickname) and char_length(nickname) between 1 and 60)),
  constraint account_devices_time_zone_check
    check (time_zone is null or char_length(time_zone) between 1 and 100),
  constraint account_devices_locale_check
    check (locale is null or char_length(locale) between 1 and 35),
  constraint account_devices_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint account_devices_timeline_check
    check (last_seen_at >= first_seen_at)
);

create index if not exists account_devices_user_last_seen_idx
  on public.account_devices (user_id, last_seen_at desc);

create table if not exists public.account_session_activity (
  auth_session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null,
  last_seen_at timestamptz not null,
  signed_out_at timestamptz,
  user_agent text,
  ip_address inet,
  device_id uuid,
  assurance_level text,
  refreshed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_session_activity_timeline_check
    check (last_seen_at >= signed_in_at),
  constraint account_session_activity_signout_check
    check (signed_out_at is null or signed_out_at >= signed_in_at),
  constraint account_session_activity_assurance_check
    check (assurance_level is null or assurance_level in ('aal1', 'aal2', 'aal3')),
  constraint account_session_activity_device_fk
    foreign key (user_id, device_id)
    references public.account_devices(user_id, device_id)
    on delete set null (device_id)
);

create index if not exists account_session_activity_user_last_seen_idx
  on public.account_session_activity (user_id, last_seen_at desc);

create index if not exists account_session_activity_user_device_idx
  on public.account_session_activity (user_id, device_id)
  where device_id is not null;

alter table public.account_devices enable row level security;
alter table public.account_session_activity enable row level security;

revoke all on table public.account_devices from anon, authenticated;
revoke all on table public.account_session_activity from anon, authenticated;

create or replace function public.touch_my_account_session(
  p_device_id uuid,
  p_time_zone text,
  p_locale text,
  p_city text,
  p_region text,
  p_country_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  current_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;

  if current_session_id is null then
    return;
  end if;

  if p_device_id is not null then
    if p_time_zone is not null and char_length(p_time_zone) not between 1 and 100 then
      raise exception 'Invalid time zone' using errcode = '22023';
    end if;
    if p_locale is not null and char_length(p_locale) not between 1 and 35 then
      raise exception 'Invalid locale' using errcode = '22023';
    end if;
    if p_country_code is not null and p_country_code !~ '^[A-Z]{2}$' then
      raise exception 'Invalid country code' using errcode = '22023';
    end if;

    insert into public.account_devices (
      user_id,
      device_id,
      time_zone,
      locale,
      city,
      region,
      country_code,
      first_seen_at,
      last_seen_at
    )
    values (
      current_user_id,
      p_device_id,
      p_time_zone,
      p_locale,
      left(nullif(btrim(p_city), ''), 100),
      left(nullif(btrim(p_region), ''), 100),
      p_country_code,
      now(),
      now()
    )
    on conflict (user_id, device_id) do update
    set
      time_zone = coalesce(excluded.time_zone, public.account_devices.time_zone),
      locale = coalesce(excluded.locale, public.account_devices.locale),
      city = coalesce(excluded.city, public.account_devices.city),
      region = coalesce(excluded.region, public.account_devices.region),
      country_code = coalesce(excluded.country_code, public.account_devices.country_code),
      last_seen_at = greatest(public.account_devices.last_seen_at, excluded.last_seen_at),
      updated_at = now();
  end if;

  insert into public.account_session_activity (
    auth_session_id,
    user_id,
    signed_in_at,
    last_seen_at,
    signed_out_at,
    user_agent,
    ip_address,
    device_id,
    assurance_level,
    refreshed_at,
    expires_at
  )
  select
    sessions.id,
    sessions.user_id,
    coalesce(sessions.created_at, now()),
    now(),
    null,
    sessions.user_agent,
    sessions.ip::inet,
    p_device_id,
    sessions.aal::text,
    sessions.refreshed_at,
    sessions.not_after
  from auth.sessions as sessions
  where sessions.id = current_session_id
    and sessions.user_id = current_user_id
  on conflict (auth_session_id) do update
  set
    last_seen_at = greatest(public.account_session_activity.last_seen_at, excluded.last_seen_at),
    signed_out_at = null,
    user_agent = coalesce(excluded.user_agent, public.account_session_activity.user_agent),
    ip_address = coalesce(excluded.ip_address, public.account_session_activity.ip_address),
    device_id = coalesce(excluded.device_id, public.account_session_activity.device_id),
    assurance_level = coalesce(
      excluded.assurance_level,
      public.account_session_activity.assurance_level
    ),
    refreshed_at = coalesce(excluded.refreshed_at, public.account_session_activity.refreshed_at),
    expires_at = coalesce(excluded.expires_at, public.account_session_activity.expires_at),
    updated_at = now();
end;
$$;

create or replace function public.end_my_account_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid;
begin
  if current_user_id is null then
    return;
  end if;

  current_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;

  if current_session_id is null then
    return;
  end if;

  perform public.touch_my_account_session(null, null, null, null, null, null);

  update public.account_session_activity
  set
    last_seen_at = greatest(last_seen_at, now()),
    signed_out_at = now(),
    updated_at = now()
  where auth_session_id = current_session_id
    and user_id = current_user_id;
end;
$$;

create or replace function public.list_my_account_sessions()
returns table (
  session_id uuid,
  signed_in_at timestamptz,
  last_seen_at timestamptz,
  signed_out_at timestamptz,
  user_agent text,
  ip_address text,
  device_id uuid,
  device_name text,
  device_first_seen_at timestamptz,
  device_session_count bigint,
  time_zone text,
  locale text,
  city text,
  region text,
  country_code text,
  assurance_level text,
  refreshed_at timestamptz,
  expires_at timestamptz,
  is_active boolean,
  is_current boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_session_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  current_session_id := nullif(
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'session_id',
    ''
  )::uuid;

  -- Backfill every currently connected device, including sessions that were
  -- established before this feature was deployed.
  insert into public.account_session_activity (
    auth_session_id,
    user_id,
    signed_in_at,
    last_seen_at,
    signed_out_at,
    user_agent,
    ip_address,
    assurance_level,
    refreshed_at,
    expires_at
  )
  select
    sessions.id,
    sessions.user_id,
    coalesce(sessions.created_at, now()),
    greatest(
      coalesce(sessions.refreshed_at, '-infinity'::timestamptz),
      coalesce(sessions.updated_at, '-infinity'::timestamptz),
      coalesce(sessions.created_at, now())
    ),
    null,
    sessions.user_agent,
    sessions.ip::inet,
    sessions.aal::text,
    sessions.refreshed_at,
    sessions.not_after
  from auth.sessions as sessions
  where sessions.user_id = current_user_id
  on conflict (auth_session_id) do update
  set
    last_seen_at = greatest(public.account_session_activity.last_seen_at, excluded.last_seen_at),
    signed_out_at = null,
    user_agent = coalesce(excluded.user_agent, public.account_session_activity.user_agent),
    ip_address = coalesce(excluded.ip_address, public.account_session_activity.ip_address),
    assurance_level = coalesce(
      excluded.assurance_level,
      public.account_session_activity.assurance_level
    ),
    refreshed_at = coalesce(excluded.refreshed_at, public.account_session_activity.refreshed_at),
    expires_at = coalesce(excluded.expires_at, public.account_session_activity.expires_at),
    updated_at = now();

  perform public.touch_my_account_session(null, null, null, null, null, null);

  -- auth.sessions is authoritative for whether a connection still exists.
  update public.account_session_activity as activity
  set
    signed_out_at = activity.last_seen_at,
    updated_at = now()
  where activity.user_id = current_user_id
    and activity.signed_out_at is null
    and not exists (
      select 1
      from auth.sessions as sessions
      where sessions.id = activity.auth_session_id
        and sessions.user_id = current_user_id
    );

  return query
  select
    activity.auth_session_id,
    activity.signed_in_at,
    activity.last_seen_at,
    activity.signed_out_at,
    activity.user_agent,
    host(activity.ip_address),
    activity.device_id,
    devices.nickname,
    devices.first_seen_at,
    count(activity.device_id) over (
      partition by activity.user_id, activity.device_id
    ) as device_session_count,
    devices.time_zone,
    devices.locale,
    devices.city,
    devices.region,
    devices.country_code,
    activity.assurance_level,
    activity.refreshed_at,
    activity.expires_at,
    exists (
      select 1
      from auth.sessions as sessions
      where sessions.id = activity.auth_session_id
        and sessions.user_id = current_user_id
    ) as is_active,
    activity.auth_session_id = current_session_id as is_current
  from public.account_session_activity as activity
  left join public.account_devices as devices
    on devices.user_id = activity.user_id
   and devices.device_id = activity.device_id
  where activity.user_id = current_user_id
  order by
    (activity.auth_session_id = current_session_id) desc,
    (activity.signed_out_at is null) desc,
    activity.last_seen_at desc
  limit 50;
end;
$$;

create or replace function public.rename_my_account_device(p_device_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(p_name);
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 1 and 60 then
    raise exception 'Invalid device name' using errcode = '22023';
  end if;

  update public.account_devices
  set
    nickname = normalized_name,
    updated_at = now()
  where user_id = current_user_id
    and device_id = p_device_id;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Device not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.touch_my_account_session(uuid, text, text, text, text, text)
  from public, anon;
revoke all on function public.end_my_account_session() from public, anon;
revoke all on function public.list_my_account_sessions() from public, anon;
revoke all on function public.rename_my_account_device(uuid, text) from public, anon;

grant execute on function public.touch_my_account_session(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.end_my_account_session() to authenticated;
grant execute on function public.list_my_account_sessions() to authenticated;
grant execute on function public.rename_my_account_device(uuid, text) to authenticated;

comment on table public.account_devices is
  'User-scoped first-party device identities and user-provided nicknames; no hardware fingerprints.';
comment on table public.account_session_activity is
  'User-scoped session history derived from Supabase Auth sessions; contains no access or refresh tokens.';
