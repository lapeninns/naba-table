\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create role anon;
create role authenticated;
create role service_role bypassrls;

create table public.restaurants (
  id uuid primary key,
  name text,
  contact_phone text,
  address text,
  google_map_url text,
  google_review_url text,
  booking_policy text
);
create table public.restaurant_memberships (
  restaurant_id uuid not null references public.restaurants(id),
  user_id uuid not null,
  role text not null,
  primary key (restaurant_id, user_id)
);
create table public.dual_sync_restaurant_controls (
  restaurant_id uuid not null references public.restaurants(id),
  provider text not null default 'google_business_profile',
  sync_paused boolean not null default false,
  primary key (restaurant_id, provider)
);
create table public.restaurant_external_profiles (
  id uuid primary key,
  restaurant_id uuid not null references public.restaurants(id),
  provider text not null,
  external_account_id text,
  external_account_name text,
  external_location_id text,
  external_location_name text,
  external_location_title text,
  external_resource_name text,
  external_place_id text,
  connection_status text not null default 'unlinked',
  sync_enabled boolean not null default true,
  pull_enabled boolean not null default true,
  push_enabled boolean not null default false,
  last_pull_at timestamptz,
  last_push_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, provider)
);
create table public.restaurant_external_profile_oauth_states (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  provider text not null,
  requested_by_user_id uuid not null,
  state_token text not null unique,
  return_path text not null default '/settings/restaurant/google-business-profile',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.restaurant_external_profile_credentials (
  external_profile_id uuid primary key references public.restaurant_external_profiles(id),
  provider_user_id text,
  connected_google_email text,
  connected_google_name text,
  refresh_token_encrypted text not null,
  granted_scopes text[] not null default array[]::text[],
  token_type text,
  last_refreshed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.restaurant_external_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  external_profile_id uuid not null references public.restaurant_external_profiles(id),
  snapshot_type text not null check (snapshot_type in ('location', 'attributes')),
  payload jsonb not null, payload_hash text not null, source_revision text,
  fetched_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);
create table public.dual_sync_snapshot_runs (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id),
  provider text not null default 'google_business_profile', run_kind text not null,
  status text not null default 'pending', raw_payload jsonb, canonical_snapshot jsonb,
  snapshot_hash text, error_code text, error_message text,
  started_at timestamptz not null default timezone('utc', now()), finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
create table public.restaurant_gbp_food_menu_snapshots (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id),
  external_profile_id uuid references public.restaurant_external_profiles(id),
  provider text not null default 'google_business_profile', snapshot_kind text not null,
  source text not null, status text not null default 'succeeded', food_menus_name text,
  raw_food_menus jsonb, canonical_food_menus jsonb,
  projection_metadata jsonb not null default '{}'::jsonb, snapshot_hash text,
  google_etag text, error_code text, error_message text, pulled_at timestamptz,
  created_by_user_id uuid, created_at timestamptz not null default timezone('utc', now())
);
create table public.dual_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  provider text not null default 'google_business_profile',
  job_kind text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  priority integer not null default 100,
  available_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  last_error_code text,
  last_error_message text,
  dead_letter_reason text
);
create table public.dual_sync_google_request_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  provider text not null default 'google_business_profile',
  publish_batch_id uuid, operation_group_id uuid, publish_operation_id uuid,
  publish_job_id text, section_key text, field_key text, direction text, write_group text,
  phase text not null, status text, google_method text,
  google_update_masks text[] not null default array[]::text[],
  request_summary jsonb not null default '{}'::jsonb, response_summary jsonb,
  error_code text, error_message text,
  retention_expires_at timestamptz not null default timezone('utc', now()) + interval '180 days',
  created_at timestamptz not null default timezone('utc', now()),
  constraint dual_sync_google_request_logs_retention_check check (retention_expires_at >= created_at)
);
create index dual_sync_google_request_logs_retention_idx
  on public.dual_sync_google_request_logs(retention_expires_at);
create table public.dual_sync_google_request_log_archives (
  id uuid primary key default gen_random_uuid(),
  original_request_log_id uuid not null default gen_random_uuid(),
  restaurant_id uuid not null default '00000000-0000-0000-0000-000000000001',
  provider text not null default 'google_business_profile',
  retention_expires_at timestamptz not null default timezone('utc', now()),
  original_created_at timestamptz not null default timezone('utc', now()),
  archived_payload jsonb not null, archived_at timestamptz not null default timezone('utc', now())
);

create table public.restaurant_business_details (restaurant_id uuid primary key, description text, source text, change_origin text);
create table public.restaurant_addresses (id uuid primary key, restaurant_id uuid not null, address_type text not null default 'storefront', source text, managed_by text not null default 'nabatable', change_origin text);
create table public.restaurant_phone_numbers (id uuid primary key, restaurant_id uuid not null, phone_kind text not null default 'primary', source text, managed_by text not null default 'nabatable', change_origin text);
create table public.restaurant_links (id uuid primary key, restaurant_id uuid not null, link_type text not null default 'other', link_status text not null default 'current', source text, managed_by text not null default 'nabatable', change_origin text);
create table public.restaurant_categories (id uuid primary key, restaurant_id uuid not null, source text, change_origin text);
create table public.restaurant_service_areas (id uuid primary key, restaurant_id uuid not null, source text, change_origin text);
create table public.restaurant_hours (id uuid primary key, restaurant_id uuid not null, source text, change_origin text);
create table public.restaurant_attributes (id uuid primary key, restaurant_id uuid not null, source text, change_origin text);
create table public.restaurant_service_items (id uuid primary key, restaurant_id uuid not null, source text, change_origin text);
create table public.restaurant_operating_hours (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  day_of_week integer, effective_date date, opens_at time, closes_at time,
  is_closed boolean not null default false, notes text,
  reservation_interval_minutes integer, reservation_slot_times text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create table public.restaurant_service_periods (
  id uuid primary key, restaurant_id uuid not null references public.restaurants(id),
  name text not null, day_of_week integer, start_time time not null,
  end_time time not null, booking_option text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create function public.replace_restaurant_operating_hours(p_restaurant_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.restaurant_operating_hours where restaurant_id = p_restaurant_id;
  insert into public.restaurant_operating_hours (
    id, restaurant_id, day_of_week, effective_date, opens_at, closes_at, is_closed
  ) select row.id, p_restaurant_id, row.day_of_week, row.effective_date,
      row.opens_at, row.closes_at, coalesce(row.is_closed, false)
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
      as row(id uuid, day_of_week integer, effective_date date,
        opens_at time, closes_at time, is_closed boolean);
end;
$$;
create function public.replace_restaurant_service_periods(p_restaurant_id uuid, p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.restaurant_service_periods where restaurant_id = p_restaurant_id;
  insert into public.restaurant_service_periods (
    id, restaurant_id, name, day_of_week, start_time, end_time, booking_option
  ) select row.id, p_restaurant_id, row.name, row.day_of_week,
      row.start_time, row.end_time, row.booking_option
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
      as row(id uuid, name text, day_of_week integer, start_time time,
        end_time time, booking_option text);
end;
$$;

insert into public.restaurants (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-000000000007');
insert into public.restaurant_memberships (restaurant_id, user_id, role)
select id, '20000000-0000-0000-0000-000000000001', 'owner'
from public.restaurants;
insert into public.restaurant_external_profiles (
  id, restaurant_id, provider, external_account_id, external_location_id,
  external_resource_name, push_enabled
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'google_business_profile', 'account-1', 'location-1', 'profile-1', true
), (
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'google_business_profile', 'account-3', 'location-3', 'profile-3', false
), (
  '10000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000006',
  'google_business_profile', 'account-6', 'location-6', 'profile-6', false
), (
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000007',
  'google_business_profile', 'account-7', 'location-7', 'profile-7', false
);
insert into public.restaurant_external_profile_oauth_states (
  restaurant_id, provider, requested_by_user_id, state_token, expires_at
) values (
  '00000000-0000-0000-0000-000000000002', 'google_business_profile',
  '20000000-0000-0000-0000-000000000001', 'legacy-raw-oauth-state',
  timezone('utc', now()) + interval '10 minutes'
);
insert into public.dual_sync_jobs (restaurant_id, job_kind, max_attempts)
values ('00000000-0000-0000-0000-000000000001', 'publish_batch', 3);

\i /workspace/supabase/migrations/20260809120000_gbp_write_safety_foundation.sql

create function public.driver_gbp_grant_item(
  p_grant_id uuid, p_bundle_order integer, p_manifest_hash text,
  p_field_keys text[] default array['title']::text[],
  p_location_id text default 'location-1', p_resource text default null,
  p_update_masks text[] default array['title']::text[],
  p_before_hashes text[] default array[repeat('b', 64)]::text[],
  p_after_hashes text[] default array[repeat('c', 64)]::text[],
  p_risk_acknowledgements text[] default array[
    'external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'
  ]::text[]
) returns public.gbp_write_grant_issue_v1 language sql immutable as $$
  select row(
    p_grant_id, 'export_to_google', p_field_keys,
    'group-' || p_bundle_order::text, 'business_info', 'PATCH',
    coalesce(p_resource, 'locations/' || p_location_id),
    p_update_masks, repeat('a', 64),
    p_before_hashes, p_after_hashes,
    repeat('d', 64), repeat('e', 64), repeat('f', 64), repeat('1', 64),
    repeat('2', 64),
    p_risk_acknowledgements,
    p_manifest_hash, p_bundle_order
  )::public.gbp_write_grant_issue_v1;
$$;

do $$
begin
  if not exists (
    select 1 from public.restaurant_external_profiles
    where id = '10000000-0000-0000-0000-000000000001'
      and write_state = 'blocked' and consent_epoch = 1
      and connection_generation = 1 and push_enabled = false
  ) then raise exception 'backfill probe failed'; end if;
  raise notice 'probe=backfill result=pass';
  if not exists (
    select 1 from public.restaurant_external_profile_oauth_states
    where restaurant_id = '00000000-0000-0000-0000-000000000002'
      and state_token = state_hash and state_hash ~ '^[a-f0-9]{64}$'
      and oidc_nonce_hash ~ '^[a-f0-9]{64}$'
      and invalidation_reason = 'legacy_unfenced' and invalidated_at is not null
  ) then raise exception 'legacy OAuth row did not fail closed'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where restaurant_id = '00000000-0000-0000-0000-000000000001'
      and job_kind = 'publish_batch' and status = 'cancelled'
      and last_error_code = 'legacy_unfenced_write_job' and finished_at is not null
  ) then raise exception 'legacy NULL-epoch write job did not fail closed'; end if;
  if exists (
    select 1 from public.restaurant_external_profile_oauth_states
    where state_token = 'legacy-raw-oauth-state'
  ) then raise exception 'legacy raw OAuth state survived migration'; end if;
  raise notice 'probe=oauth_legacy_fail_closed result=pass';
  raise notice 'probe=legacy_null_epoch_write_job_backfill result=pass';
end;
$$;

update public.restaurant_external_profiles
set write_state = 'eligible', push_enabled = true,
    external_profile_id = 'profile-1', connection_status = 'linked'
where id = '10000000-0000-0000-0000-000000000001';
update public.gbp_write_rollout_config_v1 set rollout_mode = 'on';
insert into public.gbp_write_policy_config_v1 (
  backup_window_days, proven_content_ttl_days, policy_version,
  renderer_version, approved_by_user_id, approved_at
) values (1, 28, 'policy-1', 'renderer-1',
  '20000000-0000-0000-0000-000000000001', timezone('utc', now()));

insert into public.gbp_write_grants_v1 (
  id, restaurant_id, external_profile_row_id, actor_user_id,
  external_account_id, external_profile_id, external_location_id,
  connection_generation, consent_epoch, direction, field_keys, group_id, write_group,
  google_method, google_resource, update_masks, update_masks_hash,
  before_hashes, after_hashes, request_hash, decision_hash,
  core_snapshot_hash, google_snapshot_hash, preview_fingerprint,
  risk_acknowledgements, policy_version, renderer_version, manifest_hash,
  bundle_id, bundle_order, bundle_size, bundle_hash, issued_at, expires_at
) values (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  'export_to_google', array['title'], 'legacy-group-1', 'business_info', 'PATCH',
  'locations/location-1', array['title'], repeat('a', 64),
  array[repeat('b', 64)], array[repeat('c', 64)], repeat('d', 64),
  repeat('e', 64), repeat('f', 64), repeat('1', 64), repeat('2', 64),
  array['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
  'policy-1', 'renderer-1', repeat('3', 64),
  '40000000-0000-0000-0000-000000000001', 1, 1, repeat('4', 64),
  timezone('utc', now()), timezone('utc', now()) + interval '10 minutes'
);

do $$
begin
  begin
    perform public.claim_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, '40000000-0000-0000-0000-000000000001',
      array['30000000-0000-0000-0000-000000000001']::uuid[], repeat('4', 64),
      array[repeat('3', 64)], array[repeat('d', 64)], array[repeat('e', 64)],
      array[repeat('a', 64)], 'policy-1', 'renderer-1',
      '50000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross tenant claim unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  raise notice 'probe=cross_tenant result=pass';
end;
$$;

delete from public.gbp_notification_restaurant_links_v1
where external_account_id = 'account-1';
delete from public.gbp_notification_registries_v1
where external_account_id = 'account-1';
set role service_role;
do $$
declare
  v_registry public.gbp_notification_registries_v1%rowtype;
  v_receipt public.gbp_pubsub_receipt_result_v1;
  v_duplicate public.gbp_pubsub_receipt_result_v1;
  v_unmatched public.gbp_pubsub_receipt_result_v1;
begin
  v_registry := public.link_gbp_notification_participation_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    'projects/test-project/topics/gbp-updates', 'setting-1'
  );
  if v_registry.ref_count <> 1 then raise exception 'RPC notification refcount failed'; end if;
  begin
    perform public.link_gbp_notification_participation_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 99, 1,
      'projects/test-project/topics/gbp-updates', null
    );
    raise exception 'stale RPC notification fence unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  v_receipt := public.record_gbp_pubsub_and_enqueue_v1(
    'projects/test/subscriptions/gbp', 'message-wave2d-1', repeat('a', 64),
    'GOOGLE_UPDATE', 'verified', 'accepted', v_registry.id,
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    'pubsub-wave2d-1', timezone('utc', now())
  );
  if v_receipt.processing_result <> 'accepted' or not v_receipt.receipt_inserted
    or v_receipt.job_id is null then raise exception 'accepted receipt did not atomically enqueue'; end if;
  v_duplicate := public.record_gbp_pubsub_and_enqueue_v1(
    'projects/test/subscriptions/gbp', 'message-wave2d-1', repeat('a', 64),
    'GOOGLE_UPDATE', 'verified', 'accepted', v_registry.id,
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    'pubsub-wave2d-1', timezone('utc', now())
  );
  if v_duplicate.receipt_inserted or v_duplicate.job_id <> v_receipt.job_id then
    raise exception 'duplicate receipt enqueued more than once';
  end if;
  v_unmatched := public.record_gbp_pubsub_and_enqueue_v1(
    'projects/test/subscriptions/gbp', 'message-wave2d-unmatched', repeat('b', 64),
    'GOOGLE_UPDATE', 'verified', 'accepted', v_registry.id,
    null, null, 'account-1', null, 'wrong-location', null, null,
    'pubsub-wave2d-unmatched', timezone('utc', now())
  );
  if v_unmatched.processing_result <> 'unmatched' or v_unmatched.job_id is not null then
    raise exception 'unmatched receipt enqueued work';
  end if;
  begin
    perform public.record_gbp_pubsub_and_enqueue_v1(
      'projects/test/subscriptions/gbp', 'message-wave2d-cross-tenant', repeat('c', 64),
      'GOOGLE_UPDATE', 'verified', 'accepted', v_registry.id,
      '00000000-0000-0000-0000-000000000002', null,
      'account-1', null, 'location-1', null, null,
      'pubsub-wave2d-cross-tenant', timezone('utc', now())
    );
    raise exception 'cross-tenant receipt fence unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'probe=wave2d_notification_link_fence result=pass';
  raise notice 'probe=wave2d_pubsub_atomic_dedupe result=pass';
  raise notice 'probe=wave2d_pubsub_unmatched_cross_tenant result=pass';
end;
$$;

do $$
declare v_mask public.gbp_pending_update_masks_v1%rowtype; v_count bigint;
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from timezone('utc', now())) / 1800) * 1800);
begin
  v_mask := public.upsert_gbp_pending_update_masks_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1, 'message-wave2d-1',
    array['attributes','phoneNumbers']::text[], array['attributes/has_delivery']::text[],
    'projects/test/subscriptions/gbp', 'message-wave2d-1', null,
    timezone('utc', now()), timezone('utc', now()) + interval '1 day'
  );
  select count(*) into v_count from public.read_gbp_pending_update_masks_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1, timezone('utc', now())
  );
  if v_count <> 1 then raise exception 'current pending mask was not readable'; end if;
  begin
    perform public.upsert_gbp_pending_update_masks_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 2, 'stale-mask',
      array['attributes']::text[], array[]::text[], null, null, null,
      timezone('utc', now()), timezone('utc', now()) + interval '1 day'
    );
    raise exception 'stale pending-mask fence unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.upsert_gbp_pending_update_masks_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1, 'null-mask',
      array['attributes',null]::text[], array[]::text[], null, null, null,
      timezone('utc', now()), timezone('utc', now()) + interval '1 day'
    );
    raise exception 'NULL pending-mask element unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  v_mask := public.terminalize_gbp_pending_update_masks_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    'message-wave2d-1', 'applied', timezone('utc', now())
  );
  if v_mask.status <> 'applied' then raise exception 'pending mask was not terminalized'; end if;
  select count(*) into v_count from public.enqueue_gbp_scheduled_refreshes_v1(
    timezone('utc', now()), v_bucket, 50
  ) where created;
  if v_count < 1 then raise exception 'scheduled refresh discovery enqueued no current profile'; end if;
  if exists (select 1 from public.enqueue_gbp_scheduled_refreshes_v1(
      timezone('utc', now()), v_bucket, 50) where created) then
    raise exception 'scheduled refresh bucket was not idempotent';
  end if;
  begin
    insert into public.gbp_pubsub_receipts_v1 (
      subscription, message_id, event_hash, authentication_result, processing_result
    ) values ('direct-denied', 'direct-denied', repeat('d',64), 'verified', 'ignored');
    raise exception 'direct service-role receipt insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform public.unlink_gbp_notification_participation_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1
  );
  raise notice 'probe=wave2d_pending_mask_fence_and_terminal result=pass';
  raise notice 'probe=wave2d_scheduled_refresh_bucket result=pass';
  raise notice 'probe=wave2d_direct_dml_denied result=pass';
end;
$$;
reset role;
do $$
begin
  if (select count(*) from public.dual_sync_jobs where idempotency_key = 'pubsub-wave2d-1') <> 1
    or (select payload from public.dual_sync_jobs where idempotency_key = 'pubsub-wave2d-1')
      <> jsonb_build_object('eventId','message-wave2d-1',
        'sourceReceiptSubscription','projects/test/subscriptions/gbp',
        'sourceReceiptMessageId','message-wave2d-1') then
    raise exception 'PubSub job was not one exact metadata-only envelope';
  end if;
end;
$$;
delete from public.gbp_notification_registries_v1 where external_account_id = 'account-1';

do $$
begin
  begin
    perform public.claim_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, '40000000-0000-0000-0000-000000000001',
      array['30000000-0000-0000-0000-000000000001']::uuid[], repeat('4', 64),
      array[repeat('3', 64)], array[repeat('d', 64)], array[repeat('e', 64)],
      array[repeat('a', 64)], 'policy-1', 'renderer-1',
      '50000000-0000-0000-0000-000000000009'
    );
    raise exception 'claim without readiness unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'probe=claim_without_readiness result=pass';
end;
$$;

update public.restaurants
set name = 'Core restaurant', booking_policy = 'unrelated-policy'
where id = '00000000-0000-0000-0000-000000000001';
update public.restaurants set booking_policy = 'still-unrelated'
where id = '00000000-0000-0000-0000-000000000001';
do $$
begin
  if (select count(*) from public.gbp_core_change_outbox_v1 where source_table = 'restaurants') <> 1
    or not exists (
      select 1 from public.gbp_core_change_outbox_v1
      where source_table = 'restaurants' and field_keys = array['name']::text[]
        and before_hash ~ '^[a-f0-9]{64}$' and after_hash ~ '^[a-f0-9]{64}$'
    ) then raise exception 'restaurants relevant-field trigger/filter failed'; end if;
  raise notice 'probe=core_restaurants_relevant_fields result=pass';
  raise notice 'probe=core_restaurants_unrelated_field_excluded result=pass';
end;
$$;

begin;
insert into public.restaurant_addresses (id, restaurant_id, source)
values ('60000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001', 'nabatable');
update public.restaurants set address = 'Core projection'
where id = '00000000-0000-0000-0000-000000000001';
commit;
do $$
begin
  if (select count(*) from public.gbp_core_change_outbox_v1 where source_table = 'restaurants') <> 1 then
    raise exception 'same-transaction source/projection coalescing failed';
  end if;
  raise notice 'probe=core_projection_coalesced result=pass';
end;
$$;
update public.restaurants set address = 'Direct source address'
where id = '00000000-0000-0000-0000-000000000001';

insert into public.restaurant_addresses (id, restaurant_id, address_type, source, managed_by)
values ('60000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001', 'storefront', 'nabatable', 'nabatable');
set role anon;
do $$
declare v_denied boolean := false;
begin
  begin
    perform public.apply_gbp_profile_import_to_core_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      'profile.address', 'forbidden');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'anon provider import unexpectedly accepted'; end if;
  raise notice 'probe=atomic_provider_profile_import_service_role_only result=pass';
end;
$$;
reset role;
set role service_role;
select public.apply_gbp_profile_import_to_core_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  'profile.address', 'Provider imported address'
);
reset role;
do $$
declare
  v_cross_tenant_rejected boolean := false;
  v_stale_epoch_rejected boolean := false;
begin
  if (select count(*) from public.gbp_core_change_outbox_v1
      where source_table = 'restaurants' and field_keys = array['address']::text[]) <> 1
    or exists (select 1 from public.restaurant_addresses
      where id = '60000000-0000-0000-0000-000000000021') then
    raise exception 'atomic provider import emitted echo or retained projection';
  end if;
  begin
    perform public.apply_gbp_profile_import_to_core_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      'profile.address', 'cross tenant');
  exception when sqlstate 'P0001' then v_cross_tenant_rejected := true;
  end;
  begin
    perform public.apply_gbp_profile_import_to_core_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 2,
      'profile.address', 'stale epoch');
  exception when sqlstate 'P0001' then v_stale_epoch_rejected := true;
  end;
  if not v_cross_tenant_rejected then raise exception 'cross-tenant provider import accepted'; end if;
  if not v_stale_epoch_rejected then raise exception 'stale provider import accepted'; end if;
  raise notice 'probe=atomic_provider_profile_import_no_echo result=pass';
  raise notice 'probe=atomic_provider_profile_import_cross_tenant result=pass';
  raise notice 'probe=atomic_provider_profile_import_stale_epoch result=pass';
end;
$$;

select public.replace_restaurant_operating_hours(
  '00000000-0000-0000-0000-000000000001',
  '[{"id":"82000000-0000-0000-0000-000000000001","day_of_week":0,"opens_at":"09:00","closes_at":"17:00"},{"id":"82000000-0000-0000-0000-000000000002","day_of_week":1,"opens_at":"09:00","closes_at":"17:00"},{"id":"82000000-0000-0000-0000-000000000003","day_of_week":2,"effective_date":"2026-12-25","is_closed":true}]'::jsonb
);
select public.replace_restaurant_service_periods(
  '00000000-0000-0000-0000-000000000001',
  '[{"id":"83000000-0000-0000-0000-000000000001","name":"Dinner","day_of_week":1,"start_time":"17:00","end_time":"22:00","booking_option":"dinner"}]'::jsonb
);
do $$
begin
  if (select count(*) from public.gbp_core_change_outbox_v1
      where source_table = 'restaurant_operating_hours') <> 2
    or not exists (select 1 from public.gbp_core_change_outbox_v1
      where source_table = 'restaurant_operating_hours' and field_keys = array['weekly_0']::text[])
    or not exists (select 1 from public.gbp_core_change_outbox_v1
      where source_table = 'restaurant_operating_hours' and field_keys = array['weekly_1']::text[])
    or (select count(*) from public.gbp_core_change_outbox_v1
      where source_table = 'restaurant_service_periods'
        and field_keys = array['service_periods']::text[]) <> 1 then
    raise exception 'schedule replacement RPC outbox coverage failed';
  end if;
  raise notice 'probe=core_operating_hours_rpc_outbox result=pass';
  raise notice 'probe=core_service_periods_rpc_outbox result=pass';
  raise notice 'probe=core_effective_date_override_excluded result=pass';
end;
$$;

begin;
select public.replace_restaurant_operating_hours(
  '00000000-0000-0000-0000-000000000001',
  '[{"id":"82000000-0000-0000-0000-000000000099","day_of_week":3,"opens_at":"10:00","closes_at":"16:00"}]'::jsonb
);
rollback;
do $$
begin
  if exists (select 1 from public.gbp_core_change_outbox_v1
    where source_row_id = '82000000-0000-0000-0000-000000000099') then
    raise exception 'rolled-back schedule RPC retained outbox row';
  end if;
  raise notice 'probe=core_schedule_rpc_rollback result=pass';
end;
$$;

insert into public.restaurant_operating_hours (
  id, restaurant_id, day_of_week, opens_at, closes_at
) values (
  '82000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002', 4, '08:00', '12:00'
);
do $$
begin
  if not exists (select 1 from public.gbp_core_change_outbox_v1
    where source_row_id = '82000000-0000-0000-0000-000000000010'
      and restaurant_id = '00000000-0000-0000-0000-000000000002')
    or exists (select 1 from public.gbp_core_change_outbox_v1
      where source_row_id = '82000000-0000-0000-0000-000000000010'
        and restaurant_id <> '00000000-0000-0000-0000-000000000002') then
    raise exception 'schedule source trigger crossed tenant boundary';
  end if;
  raise notice 'probe=core_schedule_tenant_isolation result=pass';
end;
$$;

update public.gbp_core_change_outbox_v1
set status = 'completed', completed_at = timezone('utc', now())
where source_table in (
  'restaurants', 'restaurant_addresses',
  'restaurant_operating_hours', 'restaurant_service_periods'
);

set role service_role;
do $$
begin
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000001', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000001', 1, repeat('6', 64)
      )]
    );
    raise exception 'issuance without readiness unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=issuance_without_readiness result=pass';
end;
$$;
reset role;

update public.restaurant_external_profiles set write_state = 'blocked', push_enabled = false
where id = '10000000-0000-0000-0000-000000000001';
set role service_role;
do $$
begin
  begin
    perform public.set_gbp_write_access_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1','profile-1','location-1',1,1,true,null
    );
    raise exception 'NULL write-access actor unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_gbp_write_access_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'account-1','profile-1','location-1',1,1,true,
      '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross-tenant write access unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.set_gbp_write_access_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1','profile-1','location-1',1,99,true,
      '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'stale write-access fence unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.set_gbp_write_access_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1','profile-1','location-1',1,1,true,
      '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'write access enabled without readiness';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'probe=wave3_write_access_actor_tenant_stale result=pass';
  raise notice 'probe=wave3_write_access_readiness_required result=pass';
end;
$$;
reset role;

insert into public.gbp_write_readiness_evidence_v1 (
  policy_version, renderer_version, backup_window_days, live_content_ttl_days,
  backup_restore_verified_at, pitr_verified_at, policy_approved_at,
  transformed_content_approved_at, issued_by_user_id, valid_until
) values (
  'policy-1', 'renderer-1', 1, 28,
  timezone('utc', now()) - interval '1 second',
  timezone('utc', now()) - interval '1 second',
  timezone('utc', now()) - interval '1 second',
  timezone('utc', now()) - interval '1 second',
  '20000000-0000-0000-0000-000000000001',
  timezone('utc', now()) + interval '7 days'
);

set role service_role;
do $$
declare v_row public.restaurant_external_profiles%rowtype; v_epoch bigint;
begin
  v_row := public.set_gbp_write_access_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1','profile-1','location-1',1,1,true,
    '20000000-0000-0000-0000-000000000001'
  );
  if v_row.write_state <> 'eligible' or not v_row.push_enabled
    or v_row.write_state_reason_code <> 'owner_enabled' then
    raise exception 'write access enable did not return authoritative eligible state';
  end if;
  v_epoch := v_row.consent_epoch;
  v_row := public.set_gbp_write_access_v1(
    v_row.restaurant_id, v_row.id, v_row.external_account_id,
    v_row.external_profile_id, v_row.external_location_id,
    v_row.connection_generation, v_row.consent_epoch, true,
    '20000000-0000-0000-0000-000000000001'
  );
  if v_row.consent_epoch <> v_epoch then raise exception 'idempotent enable changed epoch'; end if;
  raise notice 'probe=wave3_write_access_enable_idempotent result=pass';
end;
$$;
reset role;

set role service_role;
do $$
declare
  v_restaurant_id constant uuid := '00000000-0000-0000-0000-000000000001';
  v_profile_row_id constant uuid := '10000000-0000-0000-0000-000000000001';
  v_actor_id constant uuid := '20000000-0000-0000-0000-000000000001';
begin
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000070', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => '31000000-0000-0000-0000-000000000070',
        p_bundle_order => 1, p_manifest_hash => repeat('6', 64),
        p_field_keys => array['title', null]::text[],
        p_before_hashes => array[repeat('b', 64), repeat('b', 64)]::text[],
        p_after_hashes => array[repeat('c', 64), repeat('c', 64)]::text[]
      )]
    );
    raise exception 'NULL field key issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000071', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => '31000000-0000-0000-0000-000000000071',
        p_bundle_order => 1, p_manifest_hash => repeat('6', 64),
        p_update_masks => array['title', null]::text[]
      )]
    );
    raise exception 'NULL update mask issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000072', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => '31000000-0000-0000-0000-000000000072',
        p_bundle_order => 1, p_manifest_hash => repeat('6', 64),
        p_risk_acknowledgements => array[
          'external_write', 'outcome_may_be_unknown', 'partial_bundle_failure', null
        ]::text[]
      )]
    );
    raise exception 'NULL risk acknowledgement issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000073', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => '31000000-0000-0000-0000-000000000073',
        p_bundle_order => 1, p_manifest_hash => repeat('6', 64),
        p_field_keys => array['description', 'title']::text[],
        p_before_hashes => array[repeat('b', 64), null]::text[],
        p_after_hashes => array[repeat('c', 64), repeat('c', 64)]::text[]
      )]
    );
    raise exception 'NULL field hash issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000074', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => '31000000-0000-0000-0000-000000000074',
        p_bundle_order => 1, p_manifest_hash => null
      )]
    );
    raise exception 'NULL manifest hash issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      v_restaurant_id, v_profile_row_id, v_actor_id,
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000075', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        p_grant_id => null, p_bundle_order => 1, p_manifest_hash => repeat('6', 64)
      )]
    );
    raise exception 'NULL grant id issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'probe=issuance_null_array_elements result=pass';
  raise notice 'probe=issuance_null_composite_scalars result=pass';
end;
$$;

do $$
begin
  begin
    perform public.issue_and_enqueue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000076', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[
        public.driver_gbp_grant_item(
          '31000000-0000-0000-0000-000000000076', 1, repeat('6', 64)
        ),
        public.driver_gbp_grant_item(
          p_grant_id => '31000000-0000-0000-0000-000000000077',
          p_bundle_order => 2, p_manifest_hash => repeat('7', 64),
          p_after_hashes => array[null]::text[]
        )
      ], '71000000-0000-0000-0000-000000000076'
    );
    raise exception 'NULL hash enqueue unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (
    select 1 from public.gbp_write_grants_v1
    where bundle_id = '41000000-0000-0000-0000-000000000076'
  ) or exists (
    select 1 from public.dual_sync_jobs
    where id = '71000000-0000-0000-0000-000000000076'
  ) then
    raise exception 'NULL issue-and-enqueue failure was not atomic';
  end if;
  raise notice 'probe=issuance_enqueue_null_all_or_none result=pass';
end;
$$;

set role service_role;
select count(*) from public.issue_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000061', repeat('7', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[public.driver_gbp_grant_item(
    '31000000-0000-0000-0000-000000000061', 1, repeat('8', 64),
    array['title']::text[], 'location-1', 'locations/location-1'
  )]
);
select count(*) from public.issue_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000060', repeat('8', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[public.driver_gbp_grant_item(
    '31000000-0000-0000-0000-000000000060', 1, repeat('9', 64),
    array['food_menus']::text[], 'location-1',
    'accounts/account-1/locations/location-1/foodMenus'
  )]
);
do $$
declare v_resource text;
begin
  select google_resource into strict v_resource from public.gbp_write_grants_v1
  where id = '31000000-0000-0000-0000-000000000061';
  if v_resource <> 'locations/location-1' then
    raise exception 'canonical location resource was not persisted exactly';
  end if;
  for v_resource in select unnest(array[
    'locations/resource/location-1',
    'locations/location-1/',
    'locations/not-location-1',
    'accounts/account-1/locations/location-1/foodMenus/extra'
  ]::text[])
  loop
    begin
      perform public.issue_gbp_write_bundle_v1(
        '00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'account-1', 'profile-1', 'location-1', 1, 1,
        gen_random_uuid(), repeat('9', 64), 'policy-1', 'renderer-1',
        timezone('utc', now()), timezone('utc', now()) + interval '10 minutes',
        array[public.driver_gbp_grant_item(
          gen_random_uuid(), 1, repeat('a', 64), array['title']::text[],
          'location-1', v_resource
        )]
      );
      raise exception 'near-miss resource unexpectedly issued: %', v_resource;
    exception when invalid_parameter_value then null;
    end;
  end loop;
  raise notice 'probe=issuance_location_resource_exact result=pass';
  raise notice 'probe=issuance_food_menus_resource result=pass';
  raise notice 'probe=issuance_resource_near_misses result=pass';
end;
$$;
reset role;

insert into public.dual_sync_google_request_logs (
  id, restaurant_id, phase, error_code, retention_expires_at
) values (
  '94000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', 'provider_summary', 'SAFE_CODE', null
);
do $$
begin
  begin
    insert into public.dual_sync_google_request_logs (
      id, restaurant_id, phase, request_summary, retention_expires_at
    ) values (
      '94000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001', 'provider_summary',
      '{"raw":"content"}'::jsonb, null
    );
    raise exception 'content-bearing request log unexpectedly inserted';
  exception when check_violation then null;
  end;
  if (select retention_expires_at from public.dual_sync_google_request_logs
      where id = '94000000-0000-0000-0000-000000000001') is not null then
    raise exception 'metadata-only request log invented a TTL';
  end if;
  raise notice 'probe=request_log_metadata_only_nullable_ttl result=pass';
end;
$$;

set role service_role;
do $$
begin
  begin
    insert into public.gbp_write_grants_v1 (id) values ('31000000-0000-0000-0000-000000000099');
    raise exception 'direct grant insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.gbp_write_grants_v1 set reason_code = reason_code
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'direct grant update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gbp_write_grants_v1
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'direct grant delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate table public.gbp_write_grants_v1;
    raise exception 'direct grant truncate unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000002', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000002', 1, repeat('6', 64)
      )]
    );
    raise exception 'cross-tenant issuance unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000003', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()) - interval '20 minutes',
      timezone('utc', now()) - interval '5 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000003', 1, repeat('6', 64)
      )]
    );
    raise exception 'expired issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000004', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000004', 1, repeat('6', 64),
        array['z_field', 'a_field']::text[]
      )]
    );
    raise exception 'unsorted issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000005', 'tampered',
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000005', 1, repeat('6', 64)
      )]
    );
    raise exception 'tampered issuance unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'probe=grant_direct_dml_denied result=pass';
  raise notice 'probe=issuance_cross_tenant result=pass';
  raise notice 'probe=issuance_expiry result=pass';
  raise notice 'probe=issuance_sortedness result=pass';
  raise notice 'probe=issuance_tamper result=pass';
end;
$$;
reset role;

update public.gbp_write_rollout_config_v1 set rollout_mode = 'off';
set role service_role;
do $$
begin
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000006', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000006', 1, repeat('6', 64)
      )]
    );
    raise exception 'rollout-off issuance unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=issuance_rollout_off result=pass';
end;
$$;
reset role;
update public.gbp_write_rollout_config_v1 set rollout_mode = 'on';
insert into public.dual_sync_restaurant_controls (restaurant_id, sync_paused)
values ('00000000-0000-0000-0000-000000000001', true);
set role service_role;
do $$
begin
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000007', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000007', 1, repeat('6', 64)
      )]
    );
    raise exception 'paused issuance unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=issuance_pause result=pass';
end;
$$;
reset role;
update public.dual_sync_restaurant_controls set sync_paused = false
where restaurant_id = '00000000-0000-0000-0000-000000000001';

set role service_role;
select count(*) from public.issue_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000010', repeat('5', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[public.driver_gbp_grant_item(
    '31000000-0000-0000-0000-000000000010', 1, repeat('6', 64)
  )]
);
reset role;
update public.gbp_write_grants_v1
set status = 'expired', terminal_at = timezone('utc', now()), reason_code = 'driver_expired'
where id = '31000000-0000-0000-0000-000000000010';
set role service_role;
select count(*) from public.issue_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000011', repeat('5', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[public.driver_gbp_grant_item(
    '31000000-0000-0000-0000-000000000011', 1, repeat('6', 64)
  )]
);
do $$
begin
  begin
    perform public.issue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000011', repeat('5', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000012', 1, repeat('7', 64)
      )]
    );
    raise exception 'active duplicate bundle id unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  raise notice 'probe=issuance_fresh_id_same_fingerprint result=pass';
  raise notice 'probe=issuance_active_bundle_duplicate result=pass';
end;
$$;
reset role;

insert into public.dual_sync_jobs (id, restaurant_id, job_kind, max_attempts)
values ('71000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001', 'google_refresh_manual', 3);
set role service_role;
do $$
begin
  begin
    perform public.issue_and_enqueue_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      '41000000-0000-0000-0000-000000000012', repeat('8', 64),
      'policy-1', 'renderer-1', timezone('utc', now()),
      timezone('utc', now()) + interval '10 minutes',
      array[public.driver_gbp_grant_item(
        '31000000-0000-0000-0000-000000000013', 1, repeat('9', 64)
      )], '71000000-0000-0000-0000-000000000012'
    );
    raise exception 'duplicate job enqueue unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  if exists (select 1 from public.gbp_write_grants_v1 where bundle_id = '41000000-0000-0000-0000-000000000012') then
    raise exception 'failed enqueue retained grants';
  end if;
  raise notice 'probe=issuance_enqueue_all_or_none result=pass';
end;
$$;

select job_id from public.issue_and_enqueue_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000020', repeat('a', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000020', 1, repeat('b', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000021', 2, repeat('c', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000022', 3, repeat('d', 64))
  ], '71000000-0000-0000-0000-000000000020'
);
reset role;
do $$
begin
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '71000000-0000-0000-0000-000000000020'
      and status = 'queued' and max_attempts = 1
      and write_bundle_id = '41000000-0000-0000-0000-000000000020'
      and (select array_agg(key order by key) from jsonb_object_keys(payload) key) = array[
        'bundle_hash', 'bundle_id', 'confirmation_version', 'connection_generation',
        'consent_epoch', 'expires_at',
        'external_account_id', 'external_location_id', 'external_profile_id',
        'external_profile_row_id',
        'grant_ids', 'groups', 'manifest_hashes', 'policy_version',
        'renderer_version', 'restaurant_id'
      ]::text[]
      and payload ->> 'confirmation_version' = 'gbp-exact-consent-v1'
      and jsonb_array_length(payload -> 'groups') = 3
      and payload::text !~* '(raw|display|provider_content|request_body|response_body)'
  ) then raise exception 'issued queue job payload was not exact hash-only metadata'; end if;
  raise notice 'probe=issuance_enqueue_hash_only_job result=pass';
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.gbp_write_readiness_evidence_v1
    where evidence_hash ~ '^[a-f0-9]{64}$'
  ) then raise exception 'database readiness hash was not computed'; end if;
  raise notice 'probe=readiness_owner_attestation result=pass';
  raise notice 'probe=readiness_database_hash result=pass';
end;
$$;

set role service_role;
do $$
begin
  begin
    insert into public.gbp_write_readiness_evidence_v1 (
      policy_version, renderer_version, backup_window_days, live_content_ttl_days,
      backup_restore_verified_at, pitr_verified_at, policy_approved_at,
      transformed_content_approved_at, issued_by_user_id, valid_until
    ) values (
      'forged-policy', 'forged-renderer', 1, 28,
      timezone('utc', now()) - interval '1 second',
      timezone('utc', now()) - interval '1 second',
      timezone('utc', now()) - interval '1 second',
      timezone('utc', now()) - interval '1 second',
      '20000000-0000-0000-0000-000000000002',
      timezone('utc', now()) + interval '1 day'
    );
    raise exception 'service role readiness insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.gbp_write_readiness_evidence_v1 set valid_until = valid_until
    where policy_version = 'policy-1';
    raise exception 'service role readiness update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gbp_write_readiness_evidence_v1 where policy_version = 'policy-1';
    raise exception 'service role readiness delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate table public.gbp_write_readiness_evidence_v1;
    raise exception 'service role readiness truncate unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=service_role_readiness_mutations_denied result=pass';
end;
$$;
reset role;

set role service_role;
select id from public.begin_gbp_dual_sync_snapshot_run_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '93000000-0000-0000-0000-000000000001',
  'manual', timezone('utc', now())
);
select id from public.begin_gbp_dual_sync_snapshot_run_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '93000000-0000-0000-0000-000000000003',
  'manual', timezone('utc', now())
);
select id from public.fail_gbp_dual_sync_snapshot_run_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '93000000-0000-0000-0000-000000000003',
  'manual', 'UPSTREAM_503', timezone('utc', now())
);
select id from public.begin_gbp_dual_sync_snapshot_run_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '93000000-0000-0000-0000-000000000002',
  'manual', timezone('utc', now())
);
do $$
declare v_denied boolean := false;
begin
  begin
    insert into public.restaurant_external_profile_snapshots (
      id, external_profile_id, snapshot_type, payload, payload_hash
    ) values (
      '91000000-0000-0000-0000-000000000099',
      '10000000-0000-0000-0000-000000000001', 'location', '{}'::jsonb, repeat('0',64)
    );
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'direct raw snapshot insert unexpectedly succeeded'; end if;
  v_denied := false;
  begin
    insert into public.dual_sync_snapshot_runs (id, restaurant_id, provider, run_kind, status)
    values ('93000000-0000-0000-0000-000000000099',
      '00000000-0000-0000-0000-000000000001', 'google_business_profile', 'manual', 'pending');
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'direct snapshot-run insert unexpectedly succeeded'; end if;
  if (select computed_live_ttl_days from public.get_gbp_content_retention_readiness_v1()) <> 28 then
    raise exception 'backup-aware content TTL was not computed';
  end if;
  raise notice 'probe=content_direct_dml_denied result=pass';
  raise notice 'probe=content_readiness_ttl_math result=pass';
end;
$$;
select id from public.persist_gbp_external_profile_snapshot_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '91000000-0000-0000-0000-000000000001',
  'location', '{"title":"provider-title"}'::jsonb, 'revision-1', timezone('utc', now())
);
select id from public.persist_gbp_dual_sync_snapshot_run_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '93000000-0000-0000-0000-000000000001',
  'manual', '{"location":"unmodified-provider-value"}'::jsonb, timezone('utc', now())
);
do $$
declare v_parent public.gbp_content_lineage_v1%rowtype; v_copy public.gbp_content_lineage_v1%rowtype;
begin
  if (select payload_hash from public.restaurant_external_profile_snapshots
      where id = '91000000-0000-0000-0000-000000000001') <>
      encode(digest('{"title":"provider-title"}'::jsonb::text, 'sha256'), 'hex')
    or (select count(*) from public.get_current_gbp_external_profile_snapshots_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, 'location', timezone('utc', now()))) <> 1
    or (select count(*) from public.get_current_gbp_external_profile_snapshots_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, 'location', timezone('utc', now()) + interval '29 days')) <> 0 then
    raise exception 'atomic raw snapshot hash/visibility failed';
  end if;
  select * into strict v_parent from public.gbp_content_lineage_v1
  where source_row_id = '91000000-0000-0000-0000-000000000001' and content_field = 'payload';
  v_copy := public.inherit_gbp_content_lineage_v1(
    v_parent.restaurant_id, v_parent.external_profile_row_id,
    v_parent.connection_generation, v_parent.consent_epoch, v_parent.id,
    'dual_sync_jobs', '71000000-0000-0000-0000-000000000020', 'payload'
  );
  if v_copy.observed_at <> v_parent.observed_at or v_copy.expires_at <> v_parent.expires_at then
    raise exception 'inherited content lineage extended expiry';
  end if;
  if (select count(*) from public.get_current_gbp_dual_sync_snapshot_runs_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, 'manual', timezone('utc', now()))) <> 1
    or (select raw_payload from public.dual_sync_snapshot_runs
      where id = '93000000-0000-0000-0000-000000000001') <> '{"location":"unmodified-provider-value"}'::jsonb then
    raise exception 'pending dual-sync snapshot was not atomically committed/read';
  end if;
  begin
    perform public.persist_gbp_dual_sync_snapshot_run_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, '93000000-0000-0000-0000-000000000002',
      'manual', '{"stale":"must-rollback"}'::jsonb, timezone('utc', now()));
    raise exception 'cross-tenant dual-sync snapshot unexpectedly persisted';
  exception when others then
    if sqlerrm = 'cross-tenant dual-sync snapshot unexpectedly persisted' then raise; end if;
  end;
  if (select status from public.dual_sync_snapshot_runs where id = '93000000-0000-0000-0000-000000000002') <> 'pending'
    or exists (select 1 from public.gbp_content_lineage_v1 where source_row_id = '93000000-0000-0000-0000-000000000002') then
    raise exception 'failed dual-sync snapshot left partial content/lineage';
  end if;
  begin
    perform public.persist_gbp_dual_sync_snapshot_run_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, '93000000-0000-0000-0000-000000000003',
      'manual', '{"retry":"forbidden"}'::jsonb, timezone('utc', now()));
    raise exception 'failed snapshot run was retried';
  exception when others then
    if sqlerrm = 'failed snapshot run was retried' then raise; end if;
  end;
  if exists (select 1 from public.gbp_content_lineage_v1 where source_row_id = '93000000-0000-0000-0000-000000000003') then
    raise exception 'failed snapshot run created content lineage';
  end if;
  raise notice 'probe=content_atomic_snapshot_lineage result=pass';
  raise notice 'probe=content_atomic_pending_run result=pass';
  raise notice 'probe=content_raw_lineage_rollback result=pass';
  raise notice 'probe=content_failed_run_nonretryable result=pass';
  raise notice 'probe=content_expired_read_hidden result=pass';
  raise notice 'probe=content_copy_no_extension result=pass';
end;
$$;
do $$
begin
  if not exists (select 1 from public.run_gbp_content_retention_v1(
      timezone('utc', now()) + interval '29 days', 1, 5000, true,
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 1, 1)
      where store_key = 'restaurant_external_profile_snapshots'
        and matched_count = 1 and mutated_count = 0) then
    raise exception 'retention dry-run census mutated or missed content';
  end if;
  if not exists (select 1 from public.restaurant_external_profile_snapshots
      where id = '91000000-0000-0000-0000-000000000001') then
    raise exception 'retention dry-run deleted content';
  end if;
  raise notice 'probe=content_retention_dry_run result=pass';
end;
$$;
reset role;

insert into public.dual_sync_google_request_log_archives (
  id, original_request_log_id, restaurant_id, retention_expires_at,
  original_created_at, archived_payload
) values (
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001', timezone('utc', now()) - interval '1 day',
  timezone('utc', now()) - interval '2 days', '{"provider":"content"}'::jsonb
);
set role service_role;
select count(*) from public.run_gbp_content_retention_v1(
  timezone('utc', now()) + interval '29 days', 5000, 5000, false,
  '00000000-0000-0000-0000-000000000001', null, null, null);
reset role;
do $$
begin
  if exists (select 1 from public.restaurant_external_profile_snapshots
      where id = '91000000-0000-0000-0000-000000000001')
    or exists (select 1 from public.dual_sync_google_request_log_archives
      where id = '92000000-0000-0000-0000-000000000001') then
    raise exception 'retention mutation left expired content/archive';
  end if;
  raise notice 'probe=content_retention_delete result=pass';
  raise notice 'probe=content_archive_purge result=pass';
end;
$$;

set role service_role;
select count(*) from public.claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '41000000-0000-0000-0000-000000000020',
  array[
    '31000000-0000-0000-0000-000000000020',
    '31000000-0000-0000-0000-000000000021',
    '31000000-0000-0000-0000-000000000022'
  ]::uuid[], repeat('a', 64),
  array[repeat('b', 64), repeat('c', 64), repeat('d', 64)],
  array[repeat('d', 64), repeat('d', 64), repeat('d', 64)],
  array[repeat('e', 64), repeat('e', 64), repeat('e', 64)],
  array[repeat('a', 64), repeat('a', 64), repeat('a', 64)],
  'policy-1', 'renderer-1', '51000000-0000-0000-0000-000000000020'
);
do $$
begin
  begin
    perform public.dispatch_gbp_write_grant_v1(
      '00000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000020',
      '31000000-0000-0000-0000-000000000021',
      '51000000-0000-0000-0000-000000000020', 2
    );
    raise exception 'out-of-order grant dispatch unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  raise notice 'probe=per_grant_dispatch_order result=pass';
end;
$$;
select id from public.dispatch_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000020',
  '31000000-0000-0000-0000-000000000020',
  '51000000-0000-0000-0000-000000000020', 1
);
select id from public.finalize_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000020',
  '31000000-0000-0000-0000-000000000020',
  '51000000-0000-0000-0000-000000000020', 1, 'consumed', 'driver_consumed'
);
select id from public.dispatch_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000020',
  '31000000-0000-0000-0000-000000000021',
  '51000000-0000-0000-0000-000000000020', 2
);
select id from public.finalize_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000020',
  '31000000-0000-0000-0000-000000000021',
  '51000000-0000-0000-0000-000000000020', 2, 'failed', 'driver_group_failed'
);
reset role;
do $$
begin
  begin
    update public.dual_sync_jobs set status = 'retrying'
    where id = '71000000-0000-0000-0000-000000000020';
    raise exception 'mutation job retry unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  raise notice 'probe=mutation_job_retry_denied result=pass';
end;
$$;
do $$
begin
  if not exists (select 1 from public.gbp_write_grants_v1 where id = '31000000-0000-0000-0000-000000000020' and status = 'consumed')
    or not exists (select 1 from public.gbp_write_grants_v1 where id = '31000000-0000-0000-0000-000000000021' and status = 'failed')
    or not exists (select 1 from public.gbp_write_grants_v1 where id = '31000000-0000-0000-0000-000000000022' and status = 'cancelled_after_bundle_failure') then
    raise exception 'per-group failure lifecycle was not atomic';
  end if;
  raise notice 'probe=per_grant_failure_cancels_remaining result=pass';
end;
$$;

set role service_role;
select count(*) from public.issue_and_claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000030', repeat('e', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000030', 1, repeat('1', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000031', 2, repeat('2', 64))
  ], '51000000-0000-0000-0000-000000000030'
);
select id from public.dispatch_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000030',
  '31000000-0000-0000-0000-000000000030',
  '51000000-0000-0000-0000-000000000030', 1
);
select id from public.finalize_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000030',
  '31000000-0000-0000-0000-000000000030',
  '51000000-0000-0000-0000-000000000030', 1,
  'outcome_unknown', 'driver_unknown'
);
select count(*) from public.issue_and_claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000040', repeat('3', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000040', 1, repeat('4', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000041', 2, repeat('5', 64))
  ], '51000000-0000-0000-0000-000000000040'
);
select count(*) from public.cancel_gbp_claimed_bundle_before_dispatch_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000040',
  '51000000-0000-0000-0000-000000000040', 'driver_crash_before_dispatch'
);
select count(*) from public.issue_and_claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000050', repeat('6', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000050', 1, repeat('7', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000051', 2, repeat('8', 64))
  ], '51000000-0000-0000-0000-000000000050'
);
select id from public.dispatch_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000050',
  '31000000-0000-0000-0000-000000000050',
  '51000000-0000-0000-0000-000000000050', 1
);
do $$
begin
  begin
    perform public.cancel_gbp_claimed_bundle_before_dispatch_v1(
      '00000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000050',
      '51000000-0000-0000-0000-000000000050', 'blind_cancel'
    );
    raise exception 'dispatched bundle cancellation unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  raise notice 'probe=dispatched_bundle_cancel_denied result=pass';
end;
$$;
reset role;
do $$
begin
  if not exists (
    select 1 from public.gbp_write_grants_v1
    where id = '31000000-0000-0000-0000-000000000031'
      and status = 'cancelled_after_bundle_failure'
  ) then raise exception 'unknown outcome did not cancel remaining grant'; end if;
  if (select count(*) from public.gbp_write_grants_v1
      where bundle_id = '41000000-0000-0000-0000-000000000040'
        and status = 'cancelled_before_dispatch') <> 2 then
    raise exception 'crash-before-dispatch bundle was not cancelled';
  end if;
  begin
    insert into public.dual_sync_jobs (restaurant_id, job_kind, max_attempts)
    values ('00000000-0000-0000-0000-000000000001', 'auto_export', 2);
    raise exception 'multi-attempt mutation job unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  insert into public.dual_sync_jobs (
    id, restaurant_id, job_kind, status, max_attempts
  ) values (
    '71000000-0000-0000-0000-000000000060',
    '00000000-0000-0000-0000-000000000001',
    'google_refresh_manual', 'retrying', 3
  );
  raise notice 'probe=per_grant_unknown_cancels_remaining result=pass';
  raise notice 'probe=crash_before_dispatch_cancel result=pass';
  raise notice 'probe=mutation_job_max_attempts_one result=pass';
  raise notice 'probe=refresh_job_retry_unaffected result=pass';
end;
$$;

set role service_role;
select id from public.finalize_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000050',
  '31000000-0000-0000-0000-000000000050',
  '51000000-0000-0000-0000-000000000050', 1,
  'outcome_unknown', 'driver_prior_dispatch_closed'
);
select count(*) from public.issue_and_claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-1', 'profile-1', 'location-1', 1, 1,
  '41000000-0000-0000-0000-000000000080', repeat('b', 64),
  'policy-1', 'renderer-1', timezone('utc', now()),
  timezone('utc', now()) + interval '10 minutes',
  array[
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000080', 1, repeat('c', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000081', 2, repeat('d', 64)),
    public.driver_gbp_grant_item('31000000-0000-0000-0000-000000000082', 3, repeat('e', 64))
  ], '51000000-0000-0000-0000-000000000080'
);
select id from public.dispatch_gbp_write_grant_v1(
  '00000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000080',
  '31000000-0000-0000-0000-000000000080',
  '51000000-0000-0000-0000-000000000080', 1
);
reset role;
update public.gbp_write_grants_v1
set dispatched_at = timezone('utc', now()) - interval '1 hour'
where id = '31000000-0000-0000-0000-000000000080';
set role service_role;
do $$
declare v_count bigint;
begin
  select count(*) into v_count from public.recover_stale_gbp_dispatched_grants_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    timezone('utc', now()) - interval '2 hours', 100, timezone('utc', now())
  );
  if v_count <> 0 then raise exception 'fresh dispatched grant recovered before cutoff'; end if;
  begin
    perform public.recover_stale_gbp_dispatched_grants_v1(
      '00000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      timezone('utc', now()) - interval '30 minutes', 100, timezone('utc', now())
    );
    raise exception 'cross-tenant dispatch recovery unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.recover_stale_gbp_dispatched_grants_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 99,
      timezone('utc', now()) - interval '30 minutes', 100, timezone('utc', now())
    );
    raise exception 'stale-fence dispatch recovery unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.recover_stale_gbp_dispatched_grants_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'account-1', 'profile-1', 'location-1', 1, 1,
      timezone('utc', now()) - interval '30 minutes', 501, timezone('utc', now())
    );
    raise exception 'oversized dispatch recovery unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  select count(*) into v_count from public.recover_stale_gbp_dispatched_grants_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    timezone('utc', now()) - interval '30 minutes', 100, timezone('utc', now())
  );
  if v_count <> 1 then raise exception 'stale dispatched recovery count mismatch'; end if;
  select count(*) into v_count from public.recover_stale_gbp_dispatched_grants_v1(
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'account-1', 'profile-1', 'location-1', 1, 1,
    timezone('utc', now()) - interval '30 minutes', 100, timezone('utc', now())
  );
  if v_count <> 0 then raise exception 'dispatch recovery replay returned a row'; end if;
  begin
    perform public.dispatch_gbp_write_grant_v1(
      '00000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000080',
      '31000000-0000-0000-0000-000000000081',
      '51000000-0000-0000-0000-000000000080', 2
    );
    raise exception 'cancelled grant was re-emitted after dispatch recovery';
  exception when no_data_found then null;
  end;
  raise notice 'probe=stale_dispatch_cutoff_fence_limit result=pass';
  raise notice 'probe=stale_dispatch_recovery_idempotent_no_reemit result=pass';
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public.gbp_write_grants_v1
      where id = '31000000-0000-0000-0000-000000000080'
        and status = 'outcome_unknown' and reason_code = 'terminal_persistence_unknown')
    or (select count(*) from public.gbp_write_grants_v1
      where id in ('31000000-0000-0000-0000-000000000081','31000000-0000-0000-0000-000000000082')
        and status = 'cancelled_after_bundle_failure'
        and reason_code = 'terminal_persistence_unknown') <> 2
    or (select count(*) from public.gbp_consent_events_v1
      where bundle_id = '41000000-0000-0000-0000-000000000080'
        and reason_code = 'terminal_persistence_unknown') <> 3 then
    raise exception 'dispatch recovery did not atomically terminalize bundle and events';
  end if;
  raise notice 'probe=stale_dispatch_terminalizes_bundle_events result=pass';
end;
$$;

select count(*) from public.claim_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, '40000000-0000-0000-0000-000000000001',
  array['30000000-0000-0000-0000-000000000001']::uuid[], repeat('4', 64),
  array[repeat('3', 64)], array[repeat('d', 64)], array[repeat('e', 64)],
  array[repeat('a', 64)], 'policy-1', 'renderer-1',
  '50000000-0000-0000-0000-000000000001'
);

do $$
begin
  begin
    perform public.claim_gbp_write_bundle_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, '40000000-0000-0000-0000-000000000001',
      array['30000000-0000-0000-0000-000000000001']::uuid[], repeat('4', 64),
      array[repeat('3', 64)], array[repeat('d', 64)], array[repeat('e', 64)],
      array[repeat('a', 64)], 'policy-1', 'renderer-1',
      '50000000-0000-0000-0000-000000000002'
    );
    raise exception 'replay unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'probe=replay result=pass';
end;
$$;

select count(*) from public.dispatch_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001'
);
select count(*) from public.finalize_gbp_write_bundle_v1(
  '00000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001', 'outcome_unknown', 'timeout'
);

do $$
begin
  begin
    update public.gbp_write_grants_v1 set status = 'granted'
    where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'dispatched grant became reusable';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.gbp_consent_events_v1 set reason_code = 'changed'
    where grant_id = '30000000-0000-0000-0000-000000000001';
    raise exception 'consent event mutated';
  exception when sqlstate '55000' then null;
  end;
  raise notice 'probe=outcome_unknown_nonreuse result=pass';
  raise notice 'probe=immutable_event result=pass';
end;
$$;

set role service_role;
do $$
declare
  v_grant public.gbp_write_grants_v1%rowtype;
  v_notice public.gbp_terminal_outcome_notices_v1%rowtype;
  v_claim public.gbp_terminal_outcome_notices_v1%rowtype;
  v_census public.gbp_terminal_notice_census_v1;
  v_now timestamptz := timezone('utc', now());
  v_dispatch_key text;
  v_count bigint;
begin
  select * into strict v_grant from public.gbp_write_grants_v1
  where id = '30000000-0000-0000-0000-000000000001';
  v_notice := public.materialize_gbp_terminal_notice_v1(
    v_grant.restaurant_id, v_grant.id, 'grant-terminal-wave2d-1',
    'outcome_unknown', 'network_outcome_unknown', v_grant.terminal_at
  );
  if not v_notice.requires_fresh_preview
    or v_notice.due_at <> v_notice.terminal_at + interval '48 hours' then
    raise exception 'terminal notice SLA/fresh-preview contract failed';
  end if;
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1(
    'notice-worker-1', 1, 60, v_now
  );
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1(
    'notice-worker-2', 1, 60, v_claim.lease_expires_at + interval '1 second'
  );
  if v_claim.attempt_count <> 2 then raise exception 'pre-dispatch crash was not retryable'; end if;
  v_dispatch_key := 'gbp-terminal:' || v_claim.id::text || ':' || v_claim.lease_token::text;
  v_notice := public.dispatch_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-2', v_claim.lease_token,
    v_dispatch_key, v_claim.lease_expires_at - interval '1 second'
  );
  if v_notice.status <> 'dispatched' or v_notice.dispatched_at is null then
    raise exception 'notice dispatch was not durable before transport';
  end if;
  begin
    perform public.finalize_gbp_terminal_notice_v1(
      v_claim.restaurant_id, v_claim.id, 'notice-worker-2', gen_random_uuid(),
      'delivered', null, v_claim.lease_expires_at
    );
    raise exception 'wrong notice lease token unexpectedly finalized';
  exception when no_data_found then null;
  end;
  v_notice := public.finalize_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-2', v_claim.lease_token,
    'retryable_failure', 'delivery_unavailable', v_claim.lease_expires_at
  );
  if v_notice.status <> 'pending' or v_notice.available_at <= v_claim.lease_expires_at then
    raise exception 'terminal notice retry did not use DB backoff';
  end if;
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1(
    'notice-worker-3', 1, 60, v_notice.available_at
  );
  v_dispatch_key := 'gbp-terminal:' || v_claim.id::text || ':' || v_claim.lease_token::text;
  perform public.dispatch_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-3', v_claim.lease_token,
    v_dispatch_key, v_notice.available_at
  );
  v_notice := public.finalize_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-3', v_claim.lease_token,
    'outcome_unknown', 'delivery_ambiguous', v_notice.available_at + interval '1 second'
  );
  if v_notice.status <> 'outcome_unknown' or v_notice.outcome_unknown_at is null then
    raise exception 'ambiguous delivery was not terminal outcome unknown';
  end if;
  select count(*) into v_count from public.claim_gbp_terminal_notices_v1(
    'notice-worker-4', 100, 60, v_notice.outcome_unknown_at + interval '1 day'
  ) where id = v_notice.id;
  if v_count <> 0 then raise exception 'outcome unknown notice was automatically retried'; end if;
  v_census := public.get_gbp_terminal_notice_census_v1(v_notice.restaurant_id,
    v_notice.due_at + interval '1 second');
  if v_census.outcome_unknown_count <> 1 then
    raise exception 'terminal notice census hid outcome unknown';
  end if;
  begin
    delete from public.gbp_terminal_outcome_notices_v1 where id = v_notice.id;
    raise exception 'direct service-role terminal notice delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gbp_terminal_notice_delivery_attempts_v1 where notice_id = v_notice.id;
    raise exception 'direct service-role delivery attempt delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=wave2d_terminal_notice_sla result=pass';
  raise notice 'probe=wave2d_notice_crash_before_dispatch_retry result=pass';
  raise notice 'probe=wave2d_notice_dispatch_then_ambiguous_no_retry result=pass';
  raise notice 'probe=wave2d_terminal_notice_lease_backoff_census result=pass';
end;
$$;
reset role;

set role service_role;
do $$
declare v_notice public.gbp_terminal_outcome_notices_v1%rowtype;
  v_claim public.gbp_terminal_outcome_notices_v1%rowtype; v_count bigint; v_now timestamptz := timezone('utc', now());
begin
  select * into strict v_notice from public.reconcile_missing_gbp_terminal_notices_v1(1, v_now);
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1('notice-worker-finalize-gap', 1, 60, v_now);
  perform public.dispatch_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-finalize-gap', v_claim.lease_token,
    'gbp-terminal:' || v_claim.id::text || ':' || v_claim.lease_token::text, v_now
  );
  select count(*) into v_count from public.recover_stale_gbp_dispatched_notices_v1(
    1, v_claim.lease_expires_at + interval '1 second'
  ) where id = v_claim.id and status = 'outcome_unknown';
  if v_count <> 1 then raise exception 'stale dispatched notice was not outcome unknown'; end if;
  select count(*) into v_count from public.claim_gbp_terminal_notices_v1(
    'notice-worker-reemit', 100, 60, v_claim.lease_expires_at + interval '1 day'
  ) where id = v_claim.id;
  if v_count <> 0 then raise exception 'success/finalize gap notice could be re-emitted'; end if;
  v_now := timezone('utc', now());
  select * into strict v_notice from public.reconcile_missing_gbp_terminal_notices_v1(1, v_now);
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1(
    'notice-worker-confirmed', 1, 60, v_now
  );
  perform public.dispatch_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-confirmed', v_claim.lease_token,
    'gbp-terminal:' || v_claim.id::text || ':' || v_claim.lease_token::text, v_now
  );
  v_notice := public.finalize_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-confirmed', v_claim.lease_token,
    'delivered', null, v_now + interval '1 second'
  );
  if v_notice.status <> 'delivered' or v_notice.delivered_at is null then
    raise exception 'confirmed delivery was not durably finalized';
  end if;
  select * into strict v_notice from public.reconcile_missing_gbp_terminal_notices_v1(1, v_now);
  select * into strict v_claim from public.claim_gbp_terminal_notices_v1(
    'notice-worker-terminal-reject', 1, 60, v_now
  );
  perform public.dispatch_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-terminal-reject', v_claim.lease_token,
    'gbp-terminal:' || v_claim.id::text || ':' || v_claim.lease_token::text, v_now
  );
  v_notice := public.finalize_gbp_terminal_notice_v1(
    v_claim.restaurant_id, v_claim.id, 'notice-worker-terminal-reject', v_claim.lease_token,
    'terminal_failure', 'delivery_rejected_terminal', v_now + interval '1 second'
  );
  if v_notice.status <> 'failed' or v_notice.failed_at is null then
    raise exception 'terminal rejection was not failed';
  end if;
  raise notice 'probe=wave2d_notice_finalize_gap_recovery_no_reemit result=pass';
  raise notice 'probe=wave2d_notice_confirmed_delivery result=pass';
  raise notice 'probe=wave2d_notice_terminal_rejection result=pass';
end;
$$;
select count(*) from public.reconcile_missing_gbp_terminal_notices_v1(
  100, timezone('utc', now())
);
reset role;
create temporary table wave2d_reconcile_target as
select id as grant_id from public.gbp_write_grants_v1
where status in ('consumed','failed','outcome_unknown') and terminal_at is not null
order by terminal_at desc, id desc limit 1;
do $$
begin
  if (select count(*) from public.gbp_write_grants_v1
      where status in ('consumed','failed','outcome_unknown') and terminal_at is not null) <= 1 then
    raise exception 'reconciliation starvation fixture needs existing terminal history';
  end if;
  if exists (
    select 1 from public.gbp_write_grants_v1 g
    left join public.gbp_terminal_outcome_notices_v1 n
      on n.restaurant_id = g.restaurant_id and n.grant_id = g.id
    where g.status in ('consumed','failed','outcome_unknown')
      and g.terminal_at is not null and n.id is null
  ) then raise exception 'reconciliation setup did not materialize terminal history'; end if;
  delete from public.gbp_terminal_notice_delivery_attempts_v1 a
  using public.gbp_terminal_outcome_notices_v1 n, wave2d_reconcile_target t
  where a.notice_id = n.id and n.grant_id = t.grant_id;
  delete from public.gbp_terminal_outcome_notices_v1 n
  using wave2d_reconcile_target t where n.grant_id = t.grant_id;
end;
$$;
set role service_role;
do $$
declare v_row public.gbp_terminal_outcome_notices_v1%rowtype; v_count bigint;
begin
  select * into strict v_row from public.reconcile_missing_gbp_terminal_notices_v1(
    1, timezone('utc', now())
  );
  if v_row.grant_id <> (select id from public.gbp_write_grants_v1
      where status in ('consumed','failed','outcome_unknown') and terminal_at is not null
      order by terminal_at desc, id desc limit 1) then
    raise exception 'reconciliation limit starved newer missing terminal grant';
  end if;
  select count(*) into v_count from public.reconcile_missing_gbp_terminal_notices_v1(
    1, timezone('utc', now())
  );
  if v_count <> 0 then raise exception 'reconciliation was not idempotent'; end if;
  raise notice 'probe=wave2d_reconcile_antijoin_before_limit result=pass';
  raise notice 'probe=wave2d_reconcile_idempotent result=pass';
end;
$$;
reset role;

insert into public.gbp_notification_registries_v1 (external_account_id, managed_topic)
values ('account-1', 'topic-1');
do $$
begin
  begin
    insert into public.gbp_notification_registries_v1 (external_account_id, managed_topic)
    values ('account-1', 'topic-conflict');
    raise exception 'topic conflict unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  raise notice 'probe=notification_topic_conflict result=pass';
end;
$$;

do $$
declare v_registry_id uuid;
begin
  select id into strict v_registry_id from public.gbp_notification_registries_v1
  where external_account_id = 'account-1';
  begin
    insert into public.gbp_notification_restaurant_links_v1 (
      registry_id, restaurant_id, external_profile_row_id, external_account_id,
      external_profile_id, external_location_id, connection_generation, consent_epoch
    ) values (
      v_registry_id, '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 99, 1
    );
    raise exception 'stale notification link unexpectedly succeeded';
  exception when foreign_key_violation then null;
  end;
  insert into public.gbp_notification_restaurant_links_v1 (
    registry_id, restaurant_id, external_profile_row_id, external_account_id,
    external_profile_id, external_location_id, connection_generation, consent_epoch
  ) values (
    v_registry_id, '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
    'location-1', 1, 1
  );
  if (select ref_count from public.gbp_notification_registries_v1 where id = v_registry_id) <> 1 then
    raise exception 'notification refcount failed';
  end if;
  raise notice 'probe=stale_notification_link result=pass';
  raise notice 'probe=notification_refcount result=pass';
end;
$$;

do $$
begin
  begin
    perform public.record_gbp_provider_observation_v1(
      '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 99, 'restaurant_business_details',
      '60000000-0000-0000-0000-000000000001', 'title', repeat('6', 64),
      timezone('utc', now()), timezone('utc', now()) + interval '28 days'
    );
    raise exception 'stale epoch observation unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.gbp_field_provenance_v1 (
      restaurant_id, source_table, source_row_id, field_key, source, value_hash,
      external_profile_row_id, external_account_id, external_profile_id,
      external_location_id, connection_generation, consent_epoch, observed_at,
      expires_at, expiry_basis
    ) values (
      '00000000-0000-0000-0000-000000000001', 'restaurant_business_details',
      '60000000-0000-0000-0000-000000000001', 'title', 'google', repeat('6', 64),
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 1, timezone('utc', now()),
      timezone('utc', now()) + interval '31 days', 'fresh_provider_fetch'
    );
    raise exception 'retention extension unexpectedly succeeded';
  exception when check_violation then null;
  end;
  raise notice 'probe=stale_epoch result=pass';
  raise notice 'probe=retention_expiry_extension result=pass';
end;
$$;

insert into public.gbp_field_provenance_v1 (
  restaurant_id, source_table, source_row_id, field_key, source, value_hash
) values (
  '00000000-0000-0000-0000-000000000001', 'restaurant_business_details',
  '60000000-0000-0000-0000-000000000010', 'title', 'core', repeat('8', 64)
);

do $$
begin
  begin
    insert into public.gbp_field_provenance_v1 (
      restaurant_id, source_table, source_row_id, field_key, source, value_hash,
      external_profile_row_id, external_account_id, external_profile_id,
      external_location_id, connection_generation, consent_epoch, observed_at,
      expires_at, expiry_basis
    ) values (
      '00000000-0000-0000-0000-000000000001', 'restaurant_business_details',
      '60000000-0000-0000-0000-000000000011', 'title', 'google', repeat('9', 64),
      '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
      'location-1', 1, 99, timezone('utc', now()),
      timezone('utc', now()) + interval '28 days', 'fresh_provider_fetch'
    );
    raise exception 'unfenced Google provenance unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'probe=core_provenance result=pass';
  raise notice 'probe=unfenced_google_provenance result=pass';
end;
$$;

select public.record_gbp_provider_observation_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, 'restaurant_business_details',
  '60000000-0000-0000-0000-000000000012', 'title', repeat('a', 64),
  timezone('utc', now()), timezone('utc', now()) + interval '28 days'
);
do $$ begin raise notice 'probe=fenced_google_provenance result=pass'; end $$;

insert into public.restaurant_business_details (restaurant_id, description, source)
values ('00000000-0000-0000-0000-000000000001', 'Core description', 'nabatable');
update public.restaurant_business_details set source = 'gbp'
where restaurant_id = '00000000-0000-0000-0000-000000000001';
do $$
begin
  if (select count(*) from public.gbp_core_change_outbox_v1
      where source_table = 'restaurant_business_details') <> 1 then
    raise exception 'Core outbox trigger/filter probe failed';
  end if;
  raise notice 'probe=core_outbox result=pass';
end;
$$;

set role service_role;
do $$
begin
  begin
    insert into public.restaurant_external_profile_oauth_states (
      restaurant_id, provider, requested_by_user_id, state_token, state_hash,
      oidc_nonce_hash, expires_at, connection_generation, consent_epoch
    ) values (
      '00000000-0000-0000-0000-000000000002', 'google_business_profile',
      '20000000-0000-0000-0000-000000000001', repeat('1', 64), repeat('1', 64),
      repeat('2', 64), timezone('utc', now()) + interval '5 minutes', 1, 1
    );
    raise exception 'direct OAuth attempt insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=oauth_direct_dml_denied result=pass';
end;
$$;

select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', repeat('1', 64), repeat('2', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);
select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', repeat('3', 64), repeat('4', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);

do $$
begin
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000002', repeat('1', 64), repeat('2', 64),
      null, null, null, null, 1, 1
    );
    raise exception 'superseded initial OAuth attempt unexpectedly consumed';
  exception when no_data_found or insufficient_privilege then null;
  end;
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000001', repeat('3', 64), repeat('4', 64),
      null, null, null, null, 1, 1
    );
    raise exception 'cross-tenant OAuth callback unexpectedly consumed';
  exception when no_data_found or insufficient_privilege then null;
  end;
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000002', repeat('3', 64), repeat('5', 64),
      null, null, null, null, 1, 1
    );
    raise exception 'wrong OIDC nonce unexpectedly consumed';
  exception when no_data_found then null;
  end;
  raise notice 'probe=oauth_superseded_attempt result=pass';
  raise notice 'probe=oauth_cross_tenant result=pass';
  raise notice 'probe=oauth_nonce_mismatch result=pass';
end;
$$;

select id from public.consume_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000002', repeat('3', 64), repeat('4', 64),
  null, null, null, null, 1, 1
);
do $$
begin
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000002', repeat('3', 64), repeat('4', 64),
      null, null, null, null, 1, 1
    );
    raise exception 'OAuth replay unexpectedly consumed';
  exception when no_data_found then null;
  end;
  raise notice 'probe=oauth_one_shot_replay result=pass';
end;
$$;

select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001', repeat('8', 64), repeat('9', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);
reset role;
update public.restaurant_external_profile_oauth_states
set expires_at = created_at
where state_hash = repeat('8', 64);
set role service_role;
do $$
begin
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000002', repeat('8', 64), repeat('9', 64),
      null, null, null, null, 1, 1
    );
    raise exception 'expired OAuth callback unexpectedly consumed';
  exception when no_data_found then null;
  end;
  raise notice 'probe=oauth_expired_callback result=pass';
end;
$$;

select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001', repeat('6', 64), repeat('7', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes',
  '10000000-0000-0000-0000-000000000003', 'account-3', 'profile-3',
  'location-3', 1, 1
);
select id from public.transition_gbp_connection_v1(
  '00000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003', 'account-3', 'profile-3',
  'location-3', 1, 1, 'blocked', 'oauth-stale-probe',
  '20000000-0000-0000-0000-000000000001'
);
do $$
begin
  begin
    perform public.consume_gbp_oauth_attempt_v1(
      '00000000-0000-0000-0000-000000000003', repeat('6', 64), repeat('7', 64),
      '10000000-0000-0000-0000-000000000003', 'account-3', 'profile-3',
      'location-3', 1, 1
    );
    raise exception 'stale fenced OAuth callback unexpectedly consumed';
  exception when no_data_found then null;
  end;
  raise notice 'probe=oauth_stale_epoch result=pass';
end;
$$;
select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001', repeat('2', 64), repeat('0', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes',
  '10000000-0000-0000-0000-000000000003', 'account-3', 'profile-3',
  'location-3', 1, 2
);
select id from public.complete_gbp_oauth_identity_v1(
  '00000000-0000-0000-0000-000000000003', repeat('2', 64), repeat('0', 64),
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003', 'reconnect-subject', null,
  null, 'gbp.1.legacy.iv.reconnect.tag', array['scope-1'], null,
  timezone('utc', now()), timezone('utc', now())
);
reset role;
do $$
begin
  if not exists (
    select 1 from public.restaurant_external_profiles p
    join public.restaurant_external_profile_credentials c on c.external_profile_id = p.id
    where p.id = '10000000-0000-0000-0000-000000000003'
      and p.restaurant_id = '00000000-0000-0000-0000-000000000003'
      and p.connection_generation = 1 and p.consent_epoch = 2
      and p.write_state = 'blocked' and c.provider_user_id = 'reconnect-subject'
      and c.connected_google_email is null
  ) then raise exception 'atomic reconnect completion did not preserve exact fence'; end if;
  raise notice 'probe=oauth_atomic_reconnect result=pass';
end;
$$;
set role service_role;

select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001', repeat('c', 64), repeat('d', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);
select id from public.create_gbp_oauth_attempt_v1(
  '00000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001', repeat('e', 64), repeat('f', 64),
  '/settings/restaurant/google-business-profile',
  timezone('utc', now()) + interval '10 minutes', null, null, null, null, 1, 1
);
do $$
begin
  begin
    perform public.complete_gbp_oauth_identity_v1(
      '00000000-0000-0000-0000-000000000004', repeat('c', 64), repeat('d', 64),
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000004', 'old-subject', 'old@example.com',
      'Old Owner', 'gbp.1.legacy.iv.oldcipher.tag', array['scope-1'], 'Bearer',
      timezone('utc', now()), timezone('utc', now())
    );
    raise exception 'superseded OAuth completion unexpectedly persisted identity';
  exception when no_data_found then null;
  end;
  raise notice 'probe=oauth_stale_completion_rejected result=pass';
end;
$$;
select id from public.complete_gbp_oauth_identity_v1(
  '00000000-0000-0000-0000-000000000004', repeat('e', 64), repeat('f', 64),
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004', 'new-subject', 'new@example.com',
  'New Owner', 'gbp.1.legacy.iv.newcipher.tag', array['scope-2', 'scope-1'], 'Bearer',
  timezone('utc', now()), timezone('utc', now())
);
reset role;
do $$
begin
  if not exists (
    select 1 from public.restaurant_external_profiles p
    join public.restaurant_external_profile_credentials c on c.external_profile_id = p.id
    where p.id = '10000000-0000-0000-0000-000000000004'
      and p.restaurant_id = '00000000-0000-0000-0000-000000000004'
      and p.write_state = 'blocked' and p.connection_generation = 1 and p.consent_epoch = 1
      and c.provider_user_id = 'new-subject' and c.connected_google_email = 'new@example.com'
      and c.refresh_token_encrypted = 'gbp.1.legacy.iv.newcipher.tag'
      and c.identity_verified_at is not null
  ) then raise exception 'atomic first-link completion did not persist exact identity'; end if;
  if exists (
    select 1 from public.restaurant_external_profile_credentials
    where provider_user_id = 'old-subject' or connected_google_email = 'old@example.com'
  ) then raise exception 'stale completion overwrote newer identity'; end if;
  raise notice 'probe=oauth_atomic_first_link result=pass';
  raise notice 'probe=oauth_newer_completion_wins result=pass';
end;
$$;
set role service_role;
do $$
begin
  begin
    insert into public.restaurant_external_profile_credentials (
      external_profile_id, refresh_token_encrypted
    ) values (
      '10000000-0000-0000-0000-000000000004', 'gbp.1.legacy.iv.bypass.tag'
    );
    raise exception 'direct credential insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.restaurant_external_profile_credentials
    set connected_google_email = 'bypass@example.com'
    where external_profile_id = '10000000-0000-0000-0000-000000000004';
    raise exception 'direct credential update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.restaurant_external_profile_credentials
    where external_profile_id = '10000000-0000-0000-0000-000000000004';
    raise exception 'direct credential delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate table public.restaurant_external_profile_credentials;
    raise exception 'direct credential truncate unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=credential_direct_write_denied result=pass';
end;
$$;
select external_profile_id from public.refresh_gbp_credential_v1(
  '00000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004', null, null, null, 1, 1,
  'gbp.1.legacy.iv.newcipher.tag', 'gbp.1.legacy.iv.refreshcipher.tag',
  array['scope-1', 'scope-2'], 'Bearer', timezone('utc', now())
);
do $$
begin
  begin
    perform public.refresh_gbp_credential_v1(
      '00000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000004', null, null, null, 1, 1,
      'gbp.1.legacy.iv.newcipher.tag', 'gbp.1.legacy.iv.stale.tag',
      array['scope-1'], 'Bearer', timezone('utc', now())
    );
    raise exception 'stale credential refresh CAS unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  raise notice 'probe=credential_refresh_cas result=pass';
end;
$$;
reset role;
insert into public.dual_sync_jobs (
  id, restaurant_id, job_kind, status, external_profile_id, consent_epoch, max_attempts
) values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'publish_batch', 'queued', null, null, 1),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'auto_export', 'running', null, null, 1),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'auto_export', 'running', null, null, 1),
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 'auto_export', 'queued', null, null, 1),
  ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'google_refresh_manual', 'queued', 'profile-3', null, 3),
  ('70000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'google_refresh_scheduled', 'running', 'profile-3', 2, 3),
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'google_refresh_manual', 'queued', 'profile-3', null, 3),
  ('70000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'auto_export', 'running', null, null, 1),
  ('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'publish_batch', 'running', null, null, 1);
set role service_role;
select id from public.transition_gbp_connection_v1(
  '00000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003', 'account-3', 'profile-3',
  'location-3', 1, 2, 'blocked', 'read-only-epoch-fence',
  '20000000-0000-0000-0000-000000000001'
);
select id from public.rebind_gbp_connection_v1(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'account-1', 'profile-1',
  'location-1', 1, 1, 'account-new', 'profile-new', 'location-new',
  'rebind-job-fence', '20000000-0000-0000-0000-000000000001'
);
do $$
begin
  begin
    perform public.disconnect_gbp_connection_v1(
      '00000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000004', null, null, null, 1, 2,
      'disconnect-probe', '20000000-0000-0000-0000-000000000001'
    );
    raise exception 'stale disconnect credential deletion unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  raise notice 'probe=credential_disconnect_stale_fence result=pass';
end;
$$;
select id from public.disconnect_gbp_connection_v1(
  '00000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004', null, null, null, 1, 1,
  'disconnect-probe', '20000000-0000-0000-0000-000000000001'
);
reset role;
do $$
begin
  if exists (
    select 1 from public.restaurant_external_profile_credentials
    where external_profile_id = '10000000-0000-0000-0000-000000000004'
  ) then raise exception 'fenced disconnect retained credential'; end if;
  if not exists (
    select 1 from public.restaurant_external_profiles
    where id = '10000000-0000-0000-0000-000000000004'
      and write_state = 'disconnected' and connection_generation = 2 and consent_epoch = 2
      and external_account_id is null and external_profile_id is null and external_location_id is null
  ) then raise exception 'fenced disconnect did not advance connection fence'; end if;
  if (
    select count(*) from public.dual_sync_jobs
    where id in (
      '70000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000002',
      '70000000-0000-0000-0000-000000000003'
    ) and status = 'cancelled' and last_error_code = 'disconnect-probe'
  ) <> 3 then raise exception 'NULL-epoch legacy write jobs were not terminalized'; end if;
  if (
    select count(*) from public.dual_sync_jobs
    where id in (
      '70000000-0000-0000-0000-000000000005',
      '70000000-0000-0000-0000-000000000006'
    ) and status = 'cancelled' and last_error_code = 'read-only-epoch-fence'
  ) <> 2 then raise exception 'read-only exact-profile jobs were not epoch fenced'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '70000000-0000-0000-0000-000000000008'
      and status = 'cancelled' and last_error_code = 'read-only-epoch-fence'
  ) then raise exception 'NULL-epoch write job was not terminalized on disable'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '70000000-0000-0000-0000-000000000009'
      and status = 'cancelled' and last_error_code = 'rebind-job-fence'
  ) then raise exception 'NULL-epoch write job was not terminalized on rebind'; end if;
  if (
    select count(*) from public.dual_sync_jobs
    where id in (
      '70000000-0000-0000-0000-000000000004',
      '70000000-0000-0000-0000-000000000007'
    ) and status = 'queued' and finished_at is null
  ) <> 2 then raise exception 'cross-tenant jobs were terminalized'; end if;
  raise notice 'probe=credential_disconnect_atomic result=pass';
  raise notice 'probe=null_epoch_write_jobs_terminalized result=pass';
  raise notice 'probe=null_epoch_write_job_disable result=pass';
  raise notice 'probe=null_epoch_write_job_rebind result=pass';
  raise notice 'probe=read_only_jobs_epoch_fenced result=pass';
  raise notice 'probe=cross_tenant_jobs_untouched result=pass';
end;
$$;

insert into public.dual_sync_jobs (
  id, restaurant_id, job_kind, status, external_profile_id, consent_epoch, max_attempts
) values
  ('70000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 'auto_export', 'running', null, null, 1),
  ('70000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000007', 'publish_batch', 'running', null, null, 1),
  ('70000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000005', 'auto_export', 'queued', null, null, 1);
set role anon;
do $$
begin
  begin
    perform public.transition_gbp_connection_provider_failure_v1(
      '00000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
      'location-6', 1, 1, 'reauth_required', 'provider_unauthorized_401'
    );
    raise exception 'anon provider failure transition unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'probe=provider_failure_service_role_only result=pass';
end;
$$;
reset role;
set role service_role;
do $$
begin
  begin
    perform public.transition_gbp_connection_provider_failure_v1(
      '00000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
      'location-6', 1, 1, 'blocked', 'provider_invalid_grant'
    );
    raise exception 'invalid provider failure state/reason pair unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.transition_gbp_connection_provider_failure_v1(
      '00000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
      'location-6', 1, 1, 'eligible', 'provider_invalid_grant'
    );
    raise exception 'provider failure state escalation unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.transition_gbp_connection_provider_failure_v1(
      '00000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
      'location-6', 1, 1, 'reauth_required', 'provider_unauthorized_401'
    );
    raise exception 'cross-tenant provider failure transition unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.transition_gbp_connection_provider_failure_v1(
      '00000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
      'location-6', 1, 99, 'reauth_required', 'provider_unauthorized_401'
    );
    raise exception 'stale provider failure transition unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  raise notice 'probe=provider_failure_invalid_pair result=pass';
  raise notice 'probe=provider_failure_escalation_rejected result=pass';
  raise notice 'probe=provider_failure_cross_tenant result=pass';
  raise notice 'probe=provider_failure_stale_epoch result=pass';
end;
$$;
select id from public.transition_gbp_connection_provider_failure_v1(
  '00000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000006', 'account-6', 'profile-6',
  'location-6', 1, 1, 'reauth_required', 'provider_unauthorized_401'
);
select id from public.transition_gbp_connection_provider_failure_v1(
  '00000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000007', 'account-7', 'profile-7',
  'location-7', 1, 1, 'blocked', 'provider_access_lost_403'
);
reset role;
do $$
begin
  if not exists (
    select 1 from public.restaurant_external_profiles
    where id = '10000000-0000-0000-0000-000000000006'
      and restaurant_id = '00000000-0000-0000-0000-000000000006'
      and write_state = 'reauth_required' and connection_generation = 2
      and consent_epoch = 2 and write_state_actor_user_id is null
      and write_state_reason_code = 'provider_unauthorized_401'
  ) then raise exception '401 provider failure did not apply the fenced reauth transition'; end if;
  if not exists (
    select 1 from public.restaurant_external_profiles
    where id = '10000000-0000-0000-0000-000000000007'
      and restaurant_id = '00000000-0000-0000-0000-000000000007'
      and write_state = 'blocked' and connection_generation = 1
      and consent_epoch = 2 and write_state_actor_user_id is null
      and write_state_reason_code = 'provider_access_lost_403'
  ) then raise exception '403 provider failure did not apply the fenced blocked transition'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '70000000-0000-0000-0000-000000000010'
      and status = 'cancelled' and finished_at is not null
      and last_error_code = 'provider_unauthorized_401'
  ) then raise exception '401 provider failure did not terminalize NULL-epoch write job'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '70000000-0000-0000-0000-000000000011'
      and status = 'cancelled' and finished_at is not null
      and last_error_code = 'provider_access_lost_403'
  ) then raise exception '403 provider failure did not terminalize NULL-epoch write job'; end if;
  if not exists (
    select 1 from public.dual_sync_jobs
    where id = '70000000-0000-0000-0000-000000000012'
      and status = 'queued' and finished_at is null
  ) then raise exception 'provider failure transition touched a cross-tenant job'; end if;
  raise notice 'probe=provider_failure_401 result=pass';
  raise notice 'probe=provider_failure_403 result=pass';
  raise notice 'probe=provider_failure_null_epoch_jobs result=pass';
  raise notice 'probe=provider_failure_cross_tenant_job_untouched result=pass';
end;
$$;

set role service_role;
do $$
begin
  begin
    insert into public.gbp_core_change_outbox_v1 (id) values (gen_random_uuid());
    raise exception 'direct Core outbox insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.gbp_core_change_outbox_v1 set status = status;
    raise exception 'direct Core outbox update unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gbp_core_change_outbox_v1;
    raise exception 'direct Core outbox delete unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.gbp_core_change_outbox_v1;
    raise exception 'direct Core outbox truncate unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_gbp_core_changes_v1('legacy-worker', 1);
    raise exception 'legacy Core outbox claim unexpectedly remained callable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_gbp_core_change_v1(
      '00000000-0000-0000-0000-000000000001', gen_random_uuid(),
      'legacy-worker', true
    );
    raise exception 'legacy Core outbox completion unexpectedly remained callable';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.repair_gbp_core_change_v1(
      p_restaurant_id => '00000000-0000-0000-0000-000000000001',
      p_outbox_id => '81000000-0000-0000-0000-000000000001',
      p_idempotency_hash => repeat('8', 64),
      p_operator_user_id => '20000000-0000-0000-0000-000000000001',
      p_operator_repair => true, p_insert_missing => true,
      p_source_table => 'restaurant_business_details',
      p_source_row_id => '60000000-0000-0000-0000-000000000001',
      p_operation => 'INSERT', p_field_keys => array['source', null]::text[],
      p_after_hash => repeat('a', 64)
    );
    raise exception 'NULL Core outbox field key unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.repair_gbp_core_change_v1(
      p_restaurant_id => '00000000-0000-0000-0000-000000000001',
      p_outbox_id => '81000000-0000-0000-0000-000000000002',
      p_idempotency_hash => repeat('7', 64),
      p_operator_user_id => '20000000-0000-0000-0000-000000000001',
      p_operator_repair => true, p_insert_missing => true,
      p_source_table => 'restaurant_business_details',
      p_source_row_id => '60000000-0000-0000-0000-000000000001',
      p_operation => 'INSERT', p_field_keys => array['source', 'id']::text[],
      p_after_hash => repeat('a', 64)
    );
    raise exception 'unsorted Core outbox field keys unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'probe=core_outbox_direct_dml_denied result=pass';
  raise notice 'probe=core_outbox_legacy_rpc_denied result=pass';
  raise notice 'probe=core_outbox_field_keys_strict result=pass';
end;
$$;

do $$
declare v_claim public.gbp_core_change_outbox_v1%rowtype;
begin
  select * into strict v_claim from public.claim_gbp_core_changes_v2('worker-a', 1, 60);
  if v_claim.status <> 'claimed' or v_claim.attempt_count <> 1
    or v_claim.lease_token is null or v_claim.lease_expires_at <= v_claim.claimed_at then
    raise exception 'initial leased Core outbox claim is invalid';
  end if;
  raise notice 'probe=core_outbox_initial_lease result=pass';
end;
$$;
reset role;

create temporary table driver_gbp_outbox_token as
select id, lease_token from public.gbp_core_change_outbox_v1 where claimed_by = 'worker-a';
grant select on driver_gbp_outbox_token to service_role;
update public.gbp_core_change_outbox_v1
set claimed_at = timezone('utc', now()) - interval '2 minutes',
    lease_expires_at = timezone('utc', now()) - interval '1 minute'
where claimed_by = 'worker-a';

set role service_role;
do $$
declare
  v_claim public.gbp_core_change_outbox_v1%rowtype;
begin
  select * into strict v_claim from public.claim_gbp_core_changes_v2('worker-b', 1, 60);
  if v_claim.attempt_count <> 2 or v_claim.claimed_by <> 'worker-b'
    or v_claim.last_error_code <> 'lease_expired'
    or v_claim.lease_token = (select lease_token from driver_gbp_outbox_token where id = v_claim.id) then
    raise exception 'stale Core outbox lease was not safely reclaimed';
  end if;
  begin
    perform public.complete_gbp_core_change_v2(
      '00000000-0000-0000-0000-000000000002', v_claim.id,
      'worker-b', v_claim.lease_token, 'success', null
    );
    raise exception 'wrong-tenant Core outbox completion unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  begin
    perform public.complete_gbp_core_change_v2(
      v_claim.restaurant_id, v_claim.id, 'worker-b', gen_random_uuid(), 'success', null
    );
    raise exception 'wrong-token Core outbox completion unexpectedly succeeded';
  exception when no_data_found then null;
  end;
  v_claim := public.complete_gbp_core_change_v2(
    v_claim.restaurant_id, v_claim.id, 'worker-b', v_claim.lease_token,
    'retryable_failure', 'timeout'
  );
  if v_claim.status <> 'pending' or v_claim.available_at <= timezone('utc', now())
    or v_claim.last_error_code <> 'timeout' or v_claim.lease_token is not null then
    raise exception 'retryable Core outbox completion did not schedule safe backoff';
  end if;
  raise notice 'probe=core_outbox_stale_reclaim result=pass';
  raise notice 'probe=core_outbox_wrong_fence result=pass';
  raise notice 'probe=core_outbox_retry_backoff result=pass';
end;
$$;
reset role;

update public.gbp_core_change_outbox_v1 set available_at = timezone('utc', now())
where status = 'pending' and last_error_code = 'timeout';
set role service_role;
do $$
declare v_claim public.gbp_core_change_outbox_v1%rowtype;
begin
  select * into strict v_claim from public.claim_gbp_core_changes_v2('worker-c', 1, 60);
  begin
    perform public.complete_gbp_core_change_v2(
      v_claim.restaurant_id, v_claim.id, 'worker-c', v_claim.lease_token,
      'retryable_failure', 'raw stack trace: secret'
    );
    raise exception 'unsafe Core outbox error code unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  if not exists (
    select 1 from public.gbp_core_change_outbox_v1
    where id = v_claim.id and status = 'claimed' and lease_token = v_claim.lease_token
  ) then raise exception 'invalid error code mutated Core outbox claim'; end if;
  raise notice 'probe=core_outbox_safe_error_code result=pass';
end;
$$;
reset role;

update public.gbp_core_change_outbox_v1
set max_attempts = attempt_count
where status = 'claimed' and claimed_by = 'worker-c';
set role service_role;
do $$
declare v_row public.gbp_core_change_outbox_v1%rowtype;
begin
  select * into strict v_row from public.gbp_core_change_outbox_v1
  where status = 'claimed' and claimed_by = 'worker-c';
  v_row := public.complete_gbp_core_change_v2(
    v_row.restaurant_id, v_row.id, 'worker-c', v_row.lease_token,
    'retryable_failure', 'transient_error'
  );
  if v_row.status <> 'dead_letter' or v_row.dead_lettered_at is null
    or v_row.last_error_code <> 'transient_error' then
    raise exception 'exhausted Core outbox poison entry was not dead-lettered';
  end if;
  v_row := public.repair_gbp_core_change_v1(
    v_row.restaurant_id, v_row.id, v_row.idempotency_hash,
    '20000000-0000-0000-0000-000000000001', true
  );
  if v_row.status <> 'pending' or v_row.attempt_count <> 0
    or v_row.last_error_code <> 'operator_repair' then
    raise exception 'operator Core outbox repair did not reopen exact entry';
  end if;
  begin
    perform public.repair_gbp_core_change_v1(
      v_row.restaurant_id, v_row.id, v_row.idempotency_hash,
      '20000000-0000-0000-0000-000000000001', true
    );
    raise exception 'repeated Core outbox repair unexpectedly succeeded';
  exception when object_not_in_prerequisite_state then null;
  end;
  raise notice 'probe=core_outbox_exhausted_dead_letter result=pass';
  raise notice 'probe=core_outbox_repair_idempotency result=pass';
end;
$$;

select id from public.repair_gbp_core_change_v1(
  p_restaurant_id => '00000000-0000-0000-0000-000000000001',
  p_outbox_id => '81000000-0000-0000-0000-000000000003',
  p_idempotency_hash => repeat('6', 64),
  p_operator_user_id => '20000000-0000-0000-0000-000000000001',
  p_operator_repair => true, p_insert_missing => true,
  p_source_table => 'restaurant_business_details',
  p_source_row_id => '60000000-0000-0000-0000-000000000099',
  p_operation => 'INSERT', p_field_keys => array['id', 'source']::text[],
  p_after_hash => repeat('5', 64)
);
reset role;
update public.gbp_core_change_outbox_v1
set available_at = timezone('utc', now()) + interval '1 hour'
where status = 'pending' and id <> '81000000-0000-0000-0000-000000000003';
update public.gbp_core_change_outbox_v1
set attempt_count = max_attempts, available_at = timezone('utc', now())
where id = '81000000-0000-0000-0000-000000000003';
set role service_role;
do $$
declare v_claimed bigint;
begin
  select count(*) into v_claimed from public.claim_gbp_core_changes_v2('poison-worker', 100, 60);
  if v_claimed <> 0 or not exists (
    select 1 from public.gbp_core_change_outbox_v1
    where id = '81000000-0000-0000-0000-000000000003'
      and status = 'dead_letter' and dead_lettered_at is not null
  ) then raise exception 'exhausted pending Core outbox entry was claimed'; end if;
  raise notice 'probe=core_outbox_pending_poison_dead_letter result=pass';
end;
$$;
do $$
declare v_census public.gbp_core_outbox_census_v1;
begin
  v_census := public.get_gbp_core_outbox_census_v1(
    '00000000-0000-0000-0000-000000000001'
  );
  if v_census.pending_available <> (
      select count(*) from public.gbp_core_change_outbox_v1
      where restaurant_id = '00000000-0000-0000-0000-000000000001'
        and status = 'pending' and available_at <= timezone('utc', now())
    ) or v_census.dead_letter <> 1 or v_census.claimed <> 0
    or v_census.oldest_outstanding_age_seconds is null then
    raise exception 'Core outbox census does not match stored state';
  end if;
  raise notice 'probe=core_outbox_missing_repair result=pass';
  raise notice 'probe=core_outbox_census result=pass';
  raise notice 'probe=core_transaction_pending_without_followup result=pass';
  raise notice 'probe=core_provider_origin_excluded result=pass';
end;
$$;
reset role;

update public.restaurant_external_profiles set connection_status = 'linked',
  write_state = 'blocked', push_enabled = false
where id = '10000000-0000-0000-0000-000000000003';
create temporary table wave3_profile_fence as
select * from public.restaurant_external_profiles
where id = '10000000-0000-0000-0000-000000000003';
grant select on wave3_profile_fence to service_role;
set role service_role;
do $$
declare v_row public.restaurant_external_profiles%rowtype;
begin
  select * into strict v_row from wave3_profile_fence;
  v_row := public.set_gbp_write_access_v1(
    v_row.restaurant_id, v_row.id, v_row.external_account_id,
    v_row.external_profile_id, v_row.external_location_id,
    v_row.connection_generation, v_row.consent_epoch, true,
    '20000000-0000-0000-0000-000000000001'
  );
  perform public.issue_gbp_write_bundle_v1(
    v_row.restaurant_id, v_row.id, '20000000-0000-0000-0000-000000000001',
    v_row.external_account_id, v_row.external_profile_id, v_row.external_location_id,
    v_row.connection_generation, v_row.consent_epoch,
    '49000000-0000-0000-0000-000000000003', repeat('4',64),
    'policy-1','renderer-1',timezone('utc',now()),timezone('utc',now()) + interval '10 minutes',
    array[public.driver_gbp_grant_item(
      '39000000-0000-0000-0000-000000000003',1,repeat('3',64),
      p_location_id => v_row.external_location_id
    )]
  );
end;
$$;
reset role;
insert into public.dual_sync_jobs (
  id, restaurant_id, provider, job_kind, status, max_attempts,
  external_profile_id, external_account_id, external_location_id,
  connection_generation, consent_epoch
) select '79000000-0000-0000-0000-000000000031', restaurant_id,
  'google_business_profile','publish_batch','queued',1,
  external_profile_id,external_account_id,external_location_id,connection_generation,null
from public.restaurant_external_profiles where id = '10000000-0000-0000-0000-000000000003';
insert into public.dual_sync_jobs (
  id, restaurant_id, provider, job_kind, status, max_attempts,
  external_profile_id, external_account_id, external_location_id,
  connection_generation, consent_epoch
) select '79000000-0000-0000-0000-000000000032', restaurant_id,
  'google_business_profile','auto_export','running',1,
  external_profile_id,external_account_id,external_location_id,connection_generation,consent_epoch
from public.restaurant_external_profiles where id = '10000000-0000-0000-0000-000000000003';
set role service_role;
do $$
declare v_row public.restaurant_external_profiles%rowtype; v_epoch bigint; v_credential_count bigint;
begin
  select * into strict v_row from wave3_profile_fence;
  v_epoch := v_row.consent_epoch;
  select count(*) into v_credential_count from public.restaurant_external_profile_credentials
  where external_profile_id = v_row.id;
  v_row := public.set_gbp_write_access_v1(
    v_row.restaurant_id, v_row.id, v_row.external_account_id,
    v_row.external_profile_id, v_row.external_location_id,
    v_row.connection_generation, v_row.consent_epoch, false,
    '20000000-0000-0000-0000-000000000001'
  );
  if v_row.write_state <> 'blocked' or v_row.push_enabled
    or v_row.consent_epoch <> v_epoch + 1 or v_row.write_state_reason_code <> 'owner_disabled' then
    raise exception 'write access disable state/epoch failed';
  end if;
  if not exists (select 1 from public.gbp_write_grants_v1
      where id = '39000000-0000-0000-0000-000000000003' and status = 'revoked') then
    raise exception 'write access disable did not revoke grant';
  end if;
  if (select count(*) from public.restaurant_external_profile_credentials
      where external_profile_id = v_row.id) <> v_credential_count then
    raise exception 'write access disable removed read credential';
  end if;
  v_epoch := v_row.consent_epoch;
  v_row := public.set_gbp_write_access_v1(
    v_row.restaurant_id, v_row.id, v_row.external_account_id,
    v_row.external_profile_id, v_row.external_location_id,
    v_row.connection_generation, v_row.consent_epoch, false,
    '20000000-0000-0000-0000-000000000001'
  );
  if v_row.consent_epoch <> v_epoch then raise exception 'idempotent disable changed epoch'; end if;
  raise notice 'probe=wave3_write_access_disable_state_grant_credentials result=pass';
  raise notice 'probe=wave3_write_access_disable_idempotent result=pass';
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.dual_sync_jobs
      where id in ('79000000-0000-0000-0000-000000000031','79000000-0000-0000-0000-000000000032')
        and status = 'cancelled' and last_error_code = 'owner_disabled') <> 2 then
    raise exception 'write access disable did not cancel NULL/current epoch jobs';
  end if;
  raise notice 'probe=wave3_write_access_disable_jobs result=pass';
end;
$$;

do $$ begin raise notice 'probe=driver result=pass'; end $$;
