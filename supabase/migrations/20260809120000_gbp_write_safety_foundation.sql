begin;

alter table public.dual_sync_google_request_logs
  alter column retention_expires_at drop default,
  alter column retention_expires_at drop not null;
alter table public.dual_sync_google_request_logs
  drop constraint if exists dual_sync_google_request_logs_retention_check,
  add constraint dual_sync_google_request_logs_retention_check
    check (retention_expires_at is null or retention_expires_at >= created_at),
  add constraint dual_sync_google_request_logs_metadata_only_v1_check
    check (request_summary = '{}'::jsonb and response_summary is null and error_message is null) not valid,
  add constraint dual_sync_google_request_logs_safe_error_v1_check
    check (error_code is null or error_code ~ '^[A-Z0-9_:-]{1,100}$') not valid;
drop index if exists public.dual_sync_google_request_logs_retention_idx;
create index dual_sync_google_request_logs_retention_idx
  on public.dual_sync_google_request_logs(retention_expires_at)
  where retention_expires_at is not null;

create or replace function public.array_sort_unique_text(p_values text[])
returns text[] language sql immutable strict set search_path = public as $$
  select coalesce(array_agg(value order by value), array[]::text[])
  from (select distinct unnest(p_values) as value) sorted;
$$;

create or replace function public.all_sha256_text(p_values text[])
returns boolean language sql immutable strict set search_path = public as $$
  select cardinality(p_values) > 0
    and count(*) filter (where value is null) = 0
    and bool_and(value ~ '^[a-f0-9]{64}$') is true
  from unnest(p_values) value;
$$;

alter table public.restaurant_external_profiles
  add column if not exists external_profile_id text,
  add column if not exists write_state text,
  add column if not exists consent_epoch bigint,
  add column if not exists connection_generation bigint,
  add column if not exists write_state_reason_code text,
  add column if not exists write_state_actor_user_id uuid,
  add column if not exists write_state_changed_at timestamptz;

update public.restaurant_external_profiles
set external_profile_id = coalesce(external_profile_id, external_resource_name, id::text),
    write_state = 'blocked',
    consent_epoch = coalesce(consent_epoch, 1),
    connection_generation = coalesce(connection_generation, 1),
    push_enabled = false,
    write_state_reason_code = coalesce(write_state_reason_code, 'wave1a_backfill'),
    write_state_changed_at = coalesce(write_state_changed_at, timezone('utc', now()))
where provider = 'google_business_profile';

alter table public.restaurant_external_profiles
  alter column write_state set default 'blocked',
  alter column write_state set not null,
  alter column consent_epoch set default 1,
  alter column consent_epoch set not null,
  alter column connection_generation set default 1,
  alter column connection_generation set not null,
  alter column write_state_changed_at set default timezone('utc', now()),
  alter column write_state_changed_at set not null;

alter table public.restaurant_external_profiles
  add constraint restaurant_external_profiles_write_state_v1_check
  check (write_state in ('blocked', 'eligible', 'revoking', 'disconnected', 'reauth_required')),
  add constraint restaurant_external_profiles_consent_epoch_v1_check
  check (consent_epoch > 0),
  add constraint restaurant_external_profiles_connection_generation_v1_check
  check (connection_generation > 0),
  add constraint restaurant_external_profiles_push_mirror_v1_check
  check (push_enabled = (write_state = 'eligible'));

alter table public.restaurant_external_profiles
  add constraint restaurant_external_profiles_restaurant_id_id_v1_unique
  unique (restaurant_id, id),
  add constraint restaurant_external_profiles_write_fence_v1_unique
  unique (restaurant_id, id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch);

create index restaurant_external_profiles_write_fence_v1_idx
  on public.restaurant_external_profiles
  (restaurant_id, provider, external_account_id, external_profile_id,
   external_location_id, connection_generation, consent_epoch);

create table public.gbp_write_rollout_config_v1 (
  provider text primary key default 'google_business_profile',
  rollout_mode text not null default 'off',
  updated_by_user_id uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_write_rollout_config_v1_provider_check
    check (provider = 'google_business_profile'),
  constraint gbp_write_rollout_config_v1_mode_check
    check (rollout_mode in ('off', 'canary', 'allowlist', 'on'))
);

insert into public.gbp_write_rollout_config_v1 (provider, rollout_mode)
values ('google_business_profile', 'off')
on conflict (provider) do nothing;

create table public.gbp_write_canary_restaurants_v1 (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled boolean not null default true,
  added_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.gbp_write_allowlist_v1 (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled boolean not null default true,
  added_by_user_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.gbp_write_policy_config_v1 (
  provider text primary key default 'google_business_profile',
  backup_window_days integer not null,
  proven_content_ttl_days integer not null,
  policy_version text not null,
  renderer_version text not null,
  approved_by_user_id uuid not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint gbp_write_policy_config_v1_provider_check
    check (provider = 'google_business_profile'),
  constraint gbp_write_policy_config_v1_backup_check
    check (backup_window_days between 1 and 28),
  constraint gbp_write_policy_config_v1_ttl_check
    check (proven_content_ttl_days between 1 and 28),
  constraint gbp_write_policy_config_v1_backup_aware_ttl_check
    check (proven_content_ttl_days <= least(28, 30 - backup_window_days - 1)),
  constraint gbp_write_policy_config_v1_approval_check
    check (approved_at <= created_at + interval '1 minute')
);

create table public.gbp_write_readiness_evidence_v1 (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_business_profile',
  policy_version text not null,
  renderer_version text not null,
  backup_window_days integer not null,
  live_content_ttl_days integer not null,
  backup_restore_verified_at timestamptz not null,
  pitr_verified_at timestamptz not null,
  policy_approved_at timestamptz not null,
  transformed_content_approved_at timestamptz not null,
  issued_by_user_id uuid not null,
  issued_at timestamptz not null default timezone('utc', now()),
  valid_until timestamptz not null,
  evidence_hash text not null,
  constraint gbp_write_readiness_evidence_v1_provider_check
    check (provider = 'google_business_profile'),
  constraint gbp_write_readiness_evidence_v1_backup_check
    check (backup_window_days between 1 and 28),
  constraint gbp_write_readiness_evidence_v1_ttl_check
    check (live_content_ttl_days between 1 and 28 and
      live_content_ttl_days <= least(28, 30 - backup_window_days - 1)),
  constraint gbp_write_readiness_evidence_v1_proof_times_check
    check (backup_restore_verified_at <= issued_at and pitr_verified_at <= issued_at and
      backup_restore_verified_at >= issued_at - interval '30 days' and
      pitr_verified_at >= issued_at - interval '30 days' and
      policy_approved_at <= issued_at and transformed_content_approved_at <= issued_at),
  constraint gbp_write_readiness_evidence_v1_validity_check
    check (valid_until > issued_at and valid_until <= issued_at + interval '30 days'),
  constraint gbp_write_readiness_evidence_v1_hash_check
    check (evidence_hash ~ '^[a-f0-9]{64}$'),
  unique (provider, policy_version, renderer_version, evidence_hash)
);
create index gbp_write_readiness_evidence_v1_current_idx
  on public.gbp_write_readiness_evidence_v1
  (provider, policy_version, renderer_version, valid_until desc);

create or replace function public.set_gbp_readiness_hash_v1()
returns trigger language plpgsql set search_path = public as $$
begin
  new.evidence_hash := encode(digest(jsonb_build_array(
    new.id::text,
    new.provider,
    new.policy_version,
    new.renderer_version,
    new.backup_window_days,
    new.live_content_ttl_days,
    extract(epoch from new.backup_restore_verified_at),
    extract(epoch from new.pitr_verified_at),
    extract(epoch from new.policy_approved_at),
    extract(epoch from new.transformed_content_approved_at),
    new.issued_by_user_id::text,
    extract(epoch from new.issued_at),
    extract(epoch from new.valid_until)
  )::text, 'sha256'), 'hex');
  return new;
end;
$$;

create trigger gbp_write_readiness_evidence_v1_hash
before insert on public.gbp_write_readiness_evidence_v1
for each row execute function public.set_gbp_readiness_hash_v1();

create or replace function public.reject_gbp_readiness_mutation_v1()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception using errcode = '55000', message = 'GBP readiness evidence is append-only';
end;
$$;

create trigger gbp_write_readiness_evidence_v1_immutable
before update or delete on public.gbp_write_readiness_evidence_v1
for each row execute function public.reject_gbp_readiness_mutation_v1();

create table public.gbp_write_grants_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_profile_row_id uuid not null,
  actor_user_id uuid not null,
  provider text not null default 'google_business_profile',
  external_account_id text not null,
  external_profile_id text not null,
  external_location_id text not null,
  connection_generation bigint not null check (connection_generation > 0),
  consent_epoch bigint not null check (consent_epoch > 0),
  direction text not null,
  field_keys text[] not null,
  group_id text not null,
  write_group text not null,
  google_method text not null,
  google_resource text not null,
  update_masks text[] not null,
  update_masks_hash text not null,
  before_hashes text[] not null,
  after_hashes text[] not null,
  request_hash text not null,
  decision_hash text not null,
  core_snapshot_hash text not null,
  google_snapshot_hash text not null,
  preview_fingerprint text not null,
  risk_acknowledgements text[] not null,
  policy_version text not null,
  renderer_version text not null,
  manifest_hash text not null,
  bundle_id uuid not null,
  bundle_order integer not null,
  bundle_size integer not null,
  bundle_hash text not null,
  status text not null default 'granted',
  execution_id uuid,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  dispatched_at timestamptz,
  terminal_at timestamptz,
  reason_code text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint gbp_write_grants_v1_provider_check check (provider = 'google_business_profile'),
  constraint gbp_write_grants_v1_direction_check check (direction = 'export_to_google'),
  constraint gbp_write_grants_v1_group_id_check check (group_id ~ '^[A-Za-z0-9._:-]{1,100}$'),
  constraint gbp_write_grants_v1_method_check check (google_method in ('PATCH', 'POST', 'DELETE')),
  constraint gbp_write_grants_v1_resource_check check (
    google_resource = 'locations/' || external_location_id
    or google_resource = 'accounts/' || external_account_id || '/locations/' || external_location_id || '/foodMenus'
  ),
  constraint gbp_write_grants_v1_status_check check (status in ('granted', 'claimed', 'dispatched', 'consumed', 'failed', 'outcome_unknown', 'expired', 'revoked', 'cancelled_before_dispatch', 'cancelled_after_bundle_failure')),
  constraint gbp_write_grants_v1_expiry_check check (expires_at > issued_at and expires_at <= issued_at + interval '15 minutes'),
  constraint gbp_write_grants_v1_fields_check check (
    cardinality(field_keys) > 0
    and array_position(field_keys, null) is null
    and array_position(before_hashes, null) is null
    and array_position(after_hashes, null) is null
    and field_keys = public.array_sort_unique_text(field_keys)
    and cardinality(field_keys) = cardinality(before_hashes)
    and cardinality(field_keys) = cardinality(after_hashes)
  ),
  constraint gbp_write_grants_v1_masks_check check (
    cardinality(update_masks) > 0
    and array_position(update_masks, null) is null
    and update_masks = public.array_sort_unique_text(update_masks)
  ),
  constraint gbp_write_grants_v1_hashes_check check (
    request_hash ~ '^[a-f0-9]{64}$' and decision_hash ~ '^[a-f0-9]{64}$' and
    core_snapshot_hash ~ '^[a-f0-9]{64}$' and google_snapshot_hash ~ '^[a-f0-9]{64}$' and
    preview_fingerprint ~ '^[a-f0-9]{64}$' and manifest_hash ~ '^[a-f0-9]{64}$' and
    update_masks_hash ~ '^[a-f0-9]{64}$' and
    bundle_hash ~ '^[a-f0-9]{64}$' and public.all_sha256_text(before_hashes || after_hashes)
  ),
  constraint gbp_write_grants_v1_bundle_order_check check (bundle_size > 0 and bundle_order between 1 and bundle_size),
  constraint gbp_write_grants_v1_risk_check check (
    array_position(risk_acknowledgements, null) is null
    and risk_acknowledgements = public.array_sort_unique_text(risk_acknowledgements)
    and risk_acknowledgements @> array['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure']::text[]
  ),
  constraint gbp_write_grants_v1_execution_check check ((status = 'granted' and execution_id is null) or (status <> 'granted' and (execution_id is not null or status in ('expired', 'revoked')))),
  unique (restaurant_id, id),
  unique (restaurant_id, bundle_id, bundle_order),
  unique (restaurant_id, bundle_id, manifest_hash),
  constraint gbp_write_grants_v1_profile_tenant_fkey foreign key (restaurant_id, external_profile_row_id)
    references public.restaurant_external_profiles(restaurant_id, id) on delete cascade
);

create index gbp_write_grants_v1_profile_fence_idx on public.gbp_write_grants_v1
  (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, status, expires_at);
create index gbp_write_grants_v1_bundle_idx on public.gbp_write_grants_v1
  (restaurant_id, bundle_id, bundle_order, id);
create index gbp_write_grants_v1_external_profile_fk_idx on public.gbp_write_grants_v1 (external_profile_row_id);
create index gbp_write_grants_v1_stale_dispatch_idx on public.gbp_write_grants_v1
  (restaurant_id, external_profile_row_id, connection_generation, consent_epoch,
   dispatched_at, bundle_id, bundle_order, id) where status = 'dispatched';

create table public.gbp_consent_events_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  grant_id uuid,
  bundle_id uuid,
  execution_id uuid,
  event_type text not null,
  status text not null,
  actor_user_id uuid,
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  reason_code text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint gbp_consent_events_v1_status_check check (status in ('granted', 'claimed', 'dispatched', 'consumed', 'failed', 'outcome_unknown', 'expired', 'revoked', 'cancelled_before_dispatch', 'cancelled_after_bundle_failure')),
  constraint gbp_consent_events_v1_grant_tenant_fkey foreign key (restaurant_id, grant_id)
    references public.gbp_write_grants_v1(restaurant_id, id) on delete restrict
);
create index gbp_consent_events_v1_restaurant_created_idx on public.gbp_consent_events_v1 (restaurant_id, created_at, id);
create index gbp_consent_events_v1_grant_fk_idx on public.gbp_consent_events_v1 (grant_id);

create or replace function public.reject_gbp_append_only_mutation_v1()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception using errcode = '55000', message = 'GBP consent events are append-only';
end;
$$;

create trigger gbp_consent_events_v1_immutable
before update or delete on public.gbp_consent_events_v1
for each row execute function public.reject_gbp_append_only_mutation_v1();

create or replace function public.guard_gbp_grant_transition_v1()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'GBP grants cannot be deleted';
  end if;
  if tg_op = 'INSERT' and new.status <> 'granted' then
    raise exception using errcode = '55000', message = 'new GBP grants must be granted';
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status and not (
    (old.status = 'granted' and new.status in ('claimed', 'expired', 'revoked')) or
    (old.status = 'claimed' and new.status in ('dispatched', 'cancelled_before_dispatch', 'cancelled_after_bundle_failure', 'revoked')) or
    (old.status = 'dispatched' and new.status in ('consumed', 'failed', 'outcome_unknown', 'cancelled_after_bundle_failure'))
  ) then
    raise exception using errcode = '55000', message = 'invalid GBP grant transition';
  end if;
  if tg_op = 'UPDATE' and
    to_jsonb(new) - array['status', 'execution_id', 'claimed_at', 'dispatched_at', 'terminal_at', 'reason_code']::text[]
    is distinct from
    to_jsonb(old) - array['status', 'execution_id', 'claimed_at', 'dispatched_at', 'terminal_at', 'reason_code']::text[] then
    raise exception using errcode = '55000', message = 'GBP grant identity is immutable';
  end if;
  return new;
end;
$$;

create trigger gbp_write_grants_v1_transition_guard
before insert or update or delete on public.gbp_write_grants_v1
for each row execute function public.guard_gbp_grant_transition_v1();

create or replace function public.record_gbp_grant_created_v1()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.gbp_consent_events_v1 (
    restaurant_id, grant_id, bundle_id, event_type, status, actor_user_id, event_hash
  ) values (
    new.restaurant_id, new.id, new.bundle_id, 'grant_created', 'granted', new.actor_user_id,
    encode(digest(concat_ws(':', new.id::text, new.manifest_hash, 'granted'), 'sha256'), 'hex')
  );
  return new;
end;
$$;

create trigger gbp_write_grants_v1_created_event
after insert on public.gbp_write_grants_v1
for each row execute function public.record_gbp_grant_created_v1();

create table public.gbp_notification_registries_v1 (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_business_profile',
  external_account_id text not null,
  managed_topic text not null,
  provider_notification_setting_id text,
  ref_count integer not null default 0 check (ref_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_notification_registries_v1_provider_check check (provider = 'google_business_profile'),
  unique (id, external_account_id),
  unique (provider, external_account_id),
  unique (provider, external_account_id, managed_topic)
);

create table public.gbp_notification_event_types_v1 (
  registry_id uuid not null references public.gbp_notification_registries_v1(id) on delete cascade,
  event_type text not null,
  managed_by_nabatable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (registry_id, event_type),
  unique (registry_id, event_type)
);

create table public.gbp_notification_restaurant_links_v1 (
  registry_id uuid not null references public.gbp_notification_registries_v1(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_profile_row_id uuid not null,
  external_account_id text not null,
  external_profile_id text not null,
  external_location_id text not null,
  connection_generation bigint not null check (connection_generation > 0),
  consent_epoch bigint not null check (consent_epoch > 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (registry_id, restaurant_id, external_profile_row_id),
  constraint gbp_notification_links_v1_registry_account_fkey foreign key (registry_id, external_account_id)
    references public.gbp_notification_registries_v1(id, external_account_id) on delete restrict,
  constraint gbp_notification_links_v1_profile_tenant_fkey foreign key (restaurant_id, external_profile_row_id)
    references public.restaurant_external_profiles(restaurant_id, id) on delete cascade,
  constraint gbp_notification_links_v1_connection_fence_fkey foreign key
    (restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
      external_location_id, connection_generation, consent_epoch)
    references public.restaurant_external_profiles
      (restaurant_id, id, external_account_id, external_profile_id,
        external_location_id, connection_generation, consent_epoch)
    on update cascade on delete cascade
);
create index gbp_notification_restaurant_links_v1_restaurant_idx on public.gbp_notification_restaurant_links_v1 (restaurant_id, external_profile_row_id);
create index gbp_notification_restaurant_links_v1_profile_fk_idx on public.gbp_notification_restaurant_links_v1 (external_profile_row_id);

create or replace function public.refresh_gbp_notification_ref_count_v1()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.gbp_notification_registries_v1
    set ref_count = (select count(*) from public.gbp_notification_restaurant_links_v1 where registry_id = old.registry_id),
        updated_at = timezone('utc', now())
    where id = old.registry_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.gbp_notification_registries_v1
    set ref_count = (select count(*) from public.gbp_notification_restaurant_links_v1 where registry_id = new.registry_id),
        updated_at = timezone('utc', now())
    where id = new.registry_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger gbp_notification_links_v1_ref_count_insert_delete
after insert or delete on public.gbp_notification_restaurant_links_v1
for each row execute function public.refresh_gbp_notification_ref_count_v1();

create trigger gbp_notification_links_v1_ref_count_update
after update of registry_id on public.gbp_notification_restaurant_links_v1
for each row execute function public.refresh_gbp_notification_ref_count_v1();

create table public.gbp_pubsub_receipts_v1 (
  subscription text not null,
  message_id text not null,
  registry_id uuid references public.gbp_notification_registries_v1(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  external_account_id text,
  external_profile_id text,
  external_location_id text,
  connection_generation bigint,
  consent_epoch bigint,
  authentication_result text not null,
  processing_result text not null,
  event_type text,
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  job_id uuid references public.dual_sync_jobs(id) on delete set null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  primary key (subscription, message_id),
  constraint gbp_pubsub_receipts_v1_auth_check check (authentication_result in ('verified', 'rejected', 'missing', 'invalid')),
  constraint gbp_pubsub_receipts_v1_result_check check (processing_result in ('accepted', 'duplicate', 'ignored', 'rejected', 'failed')),
  constraint gbp_pubsub_receipts_v1_fence_check check ((restaurant_id is null and external_profile_id is null and external_location_id is null and connection_generation is null and consent_epoch is null) or (restaurant_id is not null and external_account_id is not null and external_profile_id is not null and external_location_id is not null and connection_generation > 0 and consent_epoch > 0))
);
create index gbp_pubsub_receipts_v1_restaurant_idx on public.gbp_pubsub_receipts_v1 (restaurant_id, received_at) where restaurant_id is not null;
create index gbp_pubsub_receipts_v1_registry_fk_idx on public.gbp_pubsub_receipts_v1 (registry_id);
create index gbp_pubsub_receipts_v1_job_fk_idx on public.gbp_pubsub_receipts_v1 (job_id);

alter table public.gbp_pubsub_receipts_v1
  add column external_profile_row_id uuid,
  add column idempotency_key text,
  add column reason_code text;
alter table public.gbp_pubsub_receipts_v1
  drop constraint gbp_pubsub_receipts_v1_result_check,
  drop constraint gbp_pubsub_receipts_v1_fence_check,
  add constraint gbp_pubsub_receipts_v1_result_check
    check (processing_result in ('accepted','duplicate','ignored','unmatched','poison','rejected','failed')),
  add constraint gbp_pubsub_receipts_v1_fence_check check (
    (restaurant_id is null and external_profile_row_id is null and external_account_id is null
      and external_profile_id is null and external_location_id is null
      and connection_generation is null and consent_epoch is null)
    or
    (restaurant_id is not null and external_profile_row_id is not null
      and external_account_id is not null and external_profile_id is not null
      and external_location_id is not null and connection_generation > 0 and consent_epoch > 0)
  ),
  add constraint gbp_pubsub_receipts_v1_subscription_check
    check (length(subscription) between 1 and 500 and subscription ~ '^[A-Za-z0-9._:/-]+$'),
  add constraint gbp_pubsub_receipts_v1_message_check
    check (message_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  add constraint gbp_pubsub_receipts_v1_safe_reason_check
    check (reason_code is null or reason_code ~ '^[a-z0-9_:-]{1,100}$'),
  add constraint gbp_pubsub_receipts_v1_profile_tenant_fkey
    foreign key (restaurant_id, external_profile_row_id)
    references public.restaurant_external_profiles(restaurant_id, id) on delete restrict;
create index gbp_pubsub_receipts_v1_profile_idx
  on public.gbp_pubsub_receipts_v1(restaurant_id, external_profile_row_id, received_at desc)
  where restaurant_id is not null;

create type public.gbp_pubsub_receipt_result_v1 as (
  processing_result text,
  receipt_inserted boolean,
  job_id uuid
);

create type public.gbp_scheduled_refresh_result_v1 as (
  restaurant_id uuid,
  job_id uuid,
  created boolean
);

create table public.gbp_pending_update_masks_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_profile_row_id uuid not null,
  external_account_id text not null,
  external_profile_id text not null,
  external_location_id text not null,
  connection_generation bigint not null check (connection_generation > 0),
  consent_epoch bigint not null check (consent_epoch > 0),
  event_id text not null,
  location_masks text[] not null default array[]::text[],
  attribute_paths text[] not null default array[]::text[],
  source_receipt_subscription text,
  source_receipt_message_id text,
  source_job_id uuid references public.dual_sync_jobs(id) on delete set null,
  status text not null default 'pending',
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  terminal_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_pending_update_masks_v1_event_check check (event_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  constraint gbp_pending_update_masks_v1_status_check check (status in ('pending','applied','stale','failed')),
  constraint gbp_pending_update_masks_v1_arrays_check check (
    cardinality(location_masks) + cardinality(attribute_paths) > 0
    and array_position(location_masks, null) is null
    and array_position(attribute_paths, null) is null
    and location_masks = public.array_sort_unique_text(location_masks)
    and attribute_paths = public.array_sort_unique_text(attribute_paths)
  ),
  constraint gbp_pending_update_masks_v1_expiry_check check (
    expires_at > observed_at and expires_at <= observed_at + interval '28 days'
  ),
  constraint gbp_pending_update_masks_v1_terminal_check check (
    (status = 'pending' and terminal_at is null) or (status <> 'pending' and terminal_at is not null)
  ),
  constraint gbp_pending_update_masks_v1_connection_fence_fkey foreign key
    (restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
      external_location_id, connection_generation, consent_epoch)
    references public.restaurant_external_profiles
      (restaurant_id, id, external_account_id, external_profile_id,
        external_location_id, connection_generation, consent_epoch)
    on update cascade on delete cascade,
  constraint gbp_pending_update_masks_v1_receipt_fkey foreign key
    (source_receipt_subscription, source_receipt_message_id)
    references public.gbp_pubsub_receipts_v1(subscription, message_id) on delete set null,
  unique (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, event_id)
);
create index gbp_pending_update_masks_v1_current_idx
  on public.gbp_pending_update_masks_v1
    (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, expires_at)
  where status = 'pending';
create index gbp_pending_update_masks_v1_profile_fk_idx
  on public.gbp_pending_update_masks_v1(external_profile_row_id);

create type public.gbp_terminal_notice_census_v1 as (
  pending_count bigint,
  overdue_count bigint,
  claimed_count bigint,
  dispatched_count bigint,
  outcome_unknown_count bigint,
  delivered_count bigint,
  failed_count bigint,
  oldest_pending_at timestamptz
);

create table public.gbp_terminal_outcome_notices_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  grant_id uuid not null,
  event_id text not null,
  terminal_kind text not null,
  safe_reason_code text not null,
  requires_fresh_preview boolean not null,
  status text not null default 'pending',
  terminal_at timestamptz not null,
  due_at timestamptz not null,
  available_at timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  claimed_by text,
  lease_token uuid,
  lease_expires_at timestamptz,
  delivery_channel text,
  dispatch_key text,
  dispatched_at timestamptz,
  outcome_unknown_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_terminal_outcome_notices_v1_grant_fkey foreign key (restaurant_id, grant_id)
    references public.gbp_write_grants_v1(restaurant_id, id) on delete restrict,
  constraint gbp_terminal_outcome_notices_v1_event_check check (event_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  constraint gbp_terminal_outcome_notices_v1_kind_check check (terminal_kind in ('consumed','failed','outcome_unknown')),
  constraint gbp_terminal_outcome_notices_v1_reason_check check (
    safe_reason_code ~ '^[a-z0-9_:-]{1,100}$'
    and (last_error_code is null or last_error_code ~ '^[a-z0-9_:-]{1,100}$')
  ),
  constraint gbp_terminal_outcome_notices_v1_status_check check (status in ('pending','claimed','dispatched','delivered','failed','outcome_unknown')),
  constraint gbp_terminal_outcome_notices_v1_preview_check check (
    requires_fresh_preview = (terminal_kind = 'outcome_unknown')
  ),
  constraint gbp_terminal_outcome_notices_v1_sla_check check (due_at = terminal_at + interval '48 hours'),
  constraint gbp_terminal_outcome_notices_v1_attempts_check check (attempt_count between 0 and max_attempts and max_attempts between 1 and 10),
  constraint gbp_terminal_outcome_notices_v1_state_check check (
    (status = 'pending' and claimed_by is null and lease_token is null and lease_expires_at is null and delivery_channel is null and dispatch_key is null and dispatched_at is null and outcome_unknown_at is null and delivered_at is null and failed_at is null)
    or (status = 'claimed' and claimed_by is not null and lease_token is not null and lease_expires_at is not null and delivery_channel is null and dispatch_key is null and dispatched_at is null and outcome_unknown_at is null and delivered_at is null and failed_at is null)
    or (status = 'dispatched' and claimed_by is not null and lease_token is not null and lease_expires_at is not null and delivery_channel = 'operational_event' and dispatch_key is not null and dispatched_at is not null and outcome_unknown_at is null and delivered_at is null and failed_at is null)
    or (status = 'delivered' and claimed_by is null and lease_token is null and lease_expires_at is null and delivery_channel = 'operational_event' and dispatch_key is not null and dispatched_at is not null and outcome_unknown_at is null and delivered_at is not null and failed_at is null)
    or (status = 'failed' and claimed_by is null and lease_token is null and lease_expires_at is null and delivery_channel = 'operational_event' and dispatch_key is not null and dispatched_at is not null and outcome_unknown_at is null and delivered_at is null and failed_at is not null)
    or (status = 'outcome_unknown' and claimed_by is null and lease_token is null and lease_expires_at is null and delivery_channel = 'operational_event' and dispatch_key is not null and dispatched_at is not null and outcome_unknown_at is not null and delivered_at is null and failed_at is null)
  ),
  constraint gbp_terminal_outcome_notices_v1_dispatch_key_check check (
    dispatch_key is null or (length(dispatch_key) between 1 and 200 and dispatch_key ~ '^[A-Za-z0-9._:-]+$')
  ),
  unique (restaurant_id, id),
  unique (restaurant_id, grant_id),
  unique (restaurant_id, event_id)
);
create index gbp_terminal_outcome_notices_v1_claim_idx
  on public.gbp_terminal_outcome_notices_v1(status, available_at, due_at, id)
  where status in ('pending','claimed');
create index gbp_terminal_outcome_notices_v1_restaurant_idx
  on public.gbp_terminal_outcome_notices_v1(restaurant_id, status, due_at);

create table public.gbp_terminal_notice_delivery_attempts_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  notice_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  channel text not null default 'operational_event' check (channel = 'operational_event'),
  dispatch_key text not null check (
    length(dispatch_key) between 1 and 200 and dispatch_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  worker_id text not null check (worker_id ~ '^[A-Za-z0-9._:-]{1,100}$'),
  lease_token uuid not null,
  status text not null default 'dispatched' check (
    status in ('dispatched','delivered','definitive_rejection','outcome_unknown')
  ),
  dispatched_at timestamptz not null,
  terminal_at timestamptz,
  safe_error_code text check (safe_error_code is null or safe_error_code ~ '^[a-z0-9_:-]{1,100}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_terminal_notice_delivery_attempts_v1_notice_fkey foreign key
    (restaurant_id, notice_id) references public.gbp_terminal_outcome_notices_v1(restaurant_id, id)
    on delete restrict,
  constraint gbp_terminal_notice_delivery_attempts_v1_state_check check (
    (status = 'dispatched' and terminal_at is null and safe_error_code is null)
    or (status = 'delivered' and terminal_at is not null and safe_error_code is null)
    or (status in ('definitive_rejection','outcome_unknown') and terminal_at is not null and safe_error_code is not null)
  ),
  unique (notice_id, attempt_number),
  unique (dispatch_key)
);
create index gbp_terminal_notice_delivery_attempts_v1_notice_idx
  on public.gbp_terminal_notice_delivery_attempts_v1(restaurant_id, notice_id, attempt_number);

create table public.gbp_field_provenance_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_table text not null,
  source_row_id uuid not null,
  field_key text not null,
  source text not null,
  value_hash text not null check (value_hash ~ '^[a-f0-9]{64}$'),
  external_profile_row_id uuid,
  external_account_id text,
  external_profile_id text,
  external_location_id text,
  connection_generation bigint,
  consent_epoch bigint,
  observed_at timestamptz,
  expires_at timestamptz,
  expiry_basis text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gbp_field_provenance_v1_source_check check (source in ('core', 'google', 'mixed')),
  constraint gbp_field_provenance_v1_expiry_check check (
    (source = 'core' and external_profile_row_id is null and external_account_id is null and
      external_profile_id is null and external_location_id is null and
      connection_generation is null and consent_epoch is null and observed_at is null and
      expires_at is null and expiry_basis is null)
    or (source in ('google', 'mixed') and external_profile_row_id is not null and
      external_account_id is not null and external_profile_id is not null and
      external_location_id is not null and connection_generation > 0 and consent_epoch > 0 and
      observed_at is not null and expires_at > observed_at and
      expires_at <= observed_at + interval '30 days' and expiry_basis = 'fresh_provider_fetch')
  ),
  unique (restaurant_id, source_table, source_row_id, field_key)
);
create index gbp_field_provenance_v1_restaurant_expiry_idx on public.gbp_field_provenance_v1 (restaurant_id, expires_at) where expires_at is not null;

create or replace function public.guard_gbp_field_provenance_v1()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source in ('google', 'mixed') and not exists (
    select 1 from public.restaurant_external_profiles p
    where p.restaurant_id = new.restaurant_id
      and p.id = new.external_profile_row_id
      and p.external_account_id = new.external_account_id
      and p.external_profile_id = new.external_profile_id
      and p.external_location_id = new.external_location_id
      and p.connection_generation = new.connection_generation
      and p.consent_epoch = new.consent_epoch
  ) then
    raise exception using errcode = '42501', message = 'stale GBP provenance fence';
  end if;
  return new;
end;
$$;

create trigger gbp_field_provenance_v1_connection_guard
before insert or update on public.gbp_field_provenance_v1
for each row execute function public.guard_gbp_field_provenance_v1();

alter table public.dual_sync_google_request_log_archives
  add column if not exists content_archive_decommissioned_at timestamptz,
  add column if not exists metadata_audit_hash text,
  add column if not exists metadata_audit_retained_until timestamptz;
comment on column public.dual_sync_google_request_log_archives.archived_payload is
  'Legacy content archive. Decommission additively; new Wave 1A audit rows must be metadata/hash only.';

create table public.gbp_content_lineage_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  external_profile_row_id uuid not null,
  external_account_id text not null,
  external_profile_id text not null,
  external_location_id text not null,
  connection_generation bigint not null check (connection_generation > 0),
  consent_epoch bigint not null check (consent_epoch > 0),
  store_key text not null,
  source_row_id uuid not null,
  content_field text not null check (content_field ~ '^[A-Za-z0-9._:-]{1,160}$'),
  value_hash text not null check (value_hash ~ '^[a-f0-9]{64}$'),
  origin_kind text not null,
  parent_lineage_id uuid references public.gbp_content_lineage_v1(id) on delete restrict,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint gbp_content_lineage_v1_store_check check (store_key in (
    'restaurant_external_profile_snapshots', 'dual_sync_snapshot_runs',
    'dual_sync_jobs', 'dual_sync_outbound_candidates', 'dual_sync_publish_operations',
    'dual_sync_google_request_logs', 'dual_sync_google_request_log_archives',
    'restaurant_gbp_food_menu_snapshots', 'restaurant_gbp_food_menu_import_reviews',
    'restaurant_gbp_food_menu_publish_attempts', 'gbp_sync_v2_drafts',
    'gbp_sync_v2_publish_jobs', 'gbp_sync_v2_publish_events', 'gbp_sync_v2_decisions',
    'dual_sync_field_states', 'dual_sync_publish_batches',
    'dual_sync_publish_operation_groups', 'restaurant_categories',
    'restaurant_service_areas', 'restaurant_attributes', 'restaurant_service_items',
    'restaurant_addresses', 'restaurant_phone_numbers', 'restaurant_links',
    'restaurant_hours', 'restaurant_gbp_food_menu_projected_identities',
    'restaurant_external_profile_sync_runs'
  )),
  constraint gbp_content_lineage_v1_origin_check check (
    (origin_kind = 'fresh_provider_fetch' and parent_lineage_id is null)
    or (origin_kind = 'inherited_copy' and parent_lineage_id is not null)
  ),
  constraint gbp_content_lineage_v1_expiry_check check (
    expires_at > observed_at and expires_at <= observed_at + interval '30 days'
  ),
  constraint gbp_content_lineage_v1_profile_fkey foreign key (
    restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch
  ) references public.restaurant_external_profiles (
    restaurant_id, id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch
  ) on delete cascade,
  unique (restaurant_id, store_key, source_row_id, content_field)
);
create index gbp_content_lineage_v1_expiry_idx
  on public.gbp_content_lineage_v1 (expires_at, restaurant_id, store_key, source_row_id);
create index gbp_content_lineage_v1_profile_idx on public.gbp_content_lineage_v1
  (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, expires_at);
create index gbp_content_lineage_v1_parent_fk_idx on public.gbp_content_lineage_v1 (parent_lineage_id);

create type public.gbp_content_retention_result_v1 as (
  store_key text, action text, matched_count bigint, mutated_count bigint,
  oldest_expires_at timestamptz, more_likely boolean
);
create type public.gbp_content_retention_readiness_v1 as (
  provider text, policy_version text, renderer_version text,
  backup_window_days integer, computed_live_ttl_days integer,
  valid_until timestamptz, ready boolean
);

create or replace function public.get_gbp_content_retention_readiness_v1(
  p_now timestamptz default timezone('utc', now())
) returns public.gbp_content_retention_readiness_v1
language plpgsql security definer set search_path = public as $$
declare v_result public.gbp_content_retention_readiness_v1;
begin
  select e.provider, e.policy_version, e.renderer_version, e.backup_window_days,
    least(28, 30 - e.backup_window_days - 1, e.live_content_ttl_days), e.valid_until,
    (e.valid_until > p_now and e.backup_restore_verified_at >= e.issued_at - interval '30 days'
      and e.pitr_verified_at >= e.issued_at - interval '30 days'
      and e.policy_approved_at <= e.issued_at
      and e.transformed_content_approved_at <= e.issued_at)
  into v_result from public.gbp_write_readiness_evidence_v1 e
  join public.gbp_write_policy_config_v1 c
    on c.provider = e.provider and c.policy_version = e.policy_version
      and c.renderer_version = e.renderer_version
      and c.backup_window_days = e.backup_window_days
      and c.proven_content_ttl_days = e.live_content_ttl_days
  where e.provider = 'google_business_profile' and e.valid_until > p_now
  order by e.issued_at desc limit 1;
  if not found then v_result := row('google_business_profile', null, null, null, null, null, false); end if;
  return v_result;
end;
$$;

create or replace function public.record_gbp_content_observation_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_store_key text, p_source_row_id uuid, p_content_fields text[],
  p_value_hashes text[], p_observed_at timestamptz
) returns setof public.gbp_content_lineage_v1
language plpgsql security definer set search_path = public as $$
declare v_ttl integer;
begin
  if cardinality(p_content_fields) is null or cardinality(p_content_fields) = 0
    or cardinality(p_content_fields) <> cardinality(p_value_hashes)
    or array_position(p_content_fields, null) is not null
    or array_position(p_value_hashes, null) is not null
    or p_content_fields <> public.array_sort_unique_text(p_content_fields)
    or not public.all_sha256_text(p_value_hashes)
    or p_observed_at < timezone('utc', now()) - interval '15 minutes'
    or p_observed_at > timezone('utc', now()) + interval '1 minute' then
    raise exception using errcode = '22023', message = 'invalid fresh GBP content observation';
  end if;
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile' and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if not found then raise no_data_found; end if;
  select computed_live_ttl_days into v_ttl
  from public.get_gbp_content_retention_readiness_v1(timezone('utc', now())) where ready;
  if v_ttl is null or v_ttl <= 0 then
    raise exception using errcode = '55000', message = 'GBP content retention readiness is not current';
  end if;
  return query insert into public.gbp_content_lineage_v1 (
    restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch, store_key,
    source_row_id, content_field, value_hash, origin_kind, observed_at, expires_at
  ) select p_restaurant_id, p_external_profile_row_id, p_external_account_id,
      p_external_profile_id, p_external_location_id, p_connection_generation,
      p_consent_epoch, p_store_key, p_source_row_id, f.content_field, f.value_hash,
      'fresh_provider_fetch', p_observed_at, p_observed_at + make_interval(days => v_ttl)
    from unnest(p_content_fields, p_value_hashes) f(content_field, value_hash)
  on conflict (restaurant_id, store_key, source_row_id, content_field) do update
    set external_profile_row_id = excluded.external_profile_row_id,
        external_account_id = excluded.external_account_id,
        external_profile_id = excluded.external_profile_id,
        external_location_id = excluded.external_location_id,
        connection_generation = excluded.connection_generation,
        consent_epoch = excluded.consent_epoch, value_hash = excluded.value_hash,
        origin_kind = excluded.origin_kind, parent_lineage_id = null,
        observed_at = excluded.observed_at, expires_at = excluded.expires_at
  returning *;
end;
$$;

create or replace function public.inherit_gbp_content_lineage_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_parent_lineage_id uuid, p_target_store_key text,
  p_target_source_row_id uuid, p_target_content_field text
) returns public.gbp_content_lineage_v1
language plpgsql security definer set search_path = public as $$
declare v_parent public.gbp_content_lineage_v1%rowtype; v_result public.gbp_content_lineage_v1%rowtype;
begin
  select * into strict v_parent from public.gbp_content_lineage_v1
  where id = p_parent_lineage_id and restaurant_id = p_restaurant_id
    and external_profile_row_id = p_external_profile_row_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  insert into public.gbp_content_lineage_v1 (
    restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch, store_key,
    source_row_id, content_field, value_hash, origin_kind, parent_lineage_id,
    observed_at, expires_at
  ) values (v_parent.restaurant_id, v_parent.external_profile_row_id,
    v_parent.external_account_id, v_parent.external_profile_id, v_parent.external_location_id,
    v_parent.connection_generation, v_parent.consent_epoch, p_target_store_key,
    p_target_source_row_id, p_target_content_field, v_parent.value_hash,
    'inherited_copy', v_parent.id, v_parent.observed_at, v_parent.expires_at)
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.persist_gbp_external_profile_snapshot_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_snapshot_id uuid,
  p_snapshot_type text, p_payload jsonb,
  p_source_revision text, p_observed_at timestamptz
) returns public.restaurant_external_profile_snapshots
language plpgsql security definer set search_path = public as $$
declare v_row public.restaurant_external_profile_snapshots%rowtype; v_payload_hash text;
begin
  if p_payload is null then
    raise exception using errcode = '22023', message = 'invalid GBP snapshot content';
  end if;
  v_payload_hash := encode(digest(p_payload::text, 'sha256'), 'hex');
  insert into public.restaurant_external_profile_snapshots (
    id, external_profile_id, snapshot_type, payload, payload_hash,
    source_revision, fetched_at
  ) values (p_snapshot_id, p_external_profile_row_id, p_snapshot_type, p_payload,
    v_payload_hash, p_source_revision, p_observed_at)
  returning * into v_row;
  perform * from public.record_gbp_content_observation_v1(
    p_restaurant_id, p_external_profile_row_id, p_external_account_id,
    p_external_profile_id, p_external_location_id, p_connection_generation,
    p_consent_epoch, 'restaurant_external_profile_snapshots', p_snapshot_id,
    case when p_source_revision is null then array['payload']::text[]
      else array['payload','source_revision']::text[] end,
    case when p_source_revision is null then array[v_payload_hash]::text[]
      else array[v_payload_hash, encode(digest(p_source_revision, 'sha256'), 'hex')]::text[] end,
    p_observed_at
  );
  return v_row;
end;
$$;

create or replace function public.get_current_gbp_external_profile_snapshots_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_snapshot_type text default null, p_now timestamptz default timezone('utc', now())
) returns setof public.restaurant_external_profile_snapshots
language sql security definer set search_path = public stable as $$
  select s.* from public.restaurant_external_profile_snapshots s
  join public.restaurant_external_profiles p
    on p.id = s.external_profile_id and p.restaurant_id = p_restaurant_id
  where p.id = p_external_profile_row_id and p.provider = 'google_business_profile'
    and p.external_account_id = p_external_account_id
    and p.external_profile_id = p_external_profile_id
    and p.external_location_id = p_external_location_id
    and p.connection_generation = p_connection_generation and p.consent_epoch = p_consent_epoch
    and (p_snapshot_type is null or s.snapshot_type = p_snapshot_type)
    and exists (select 1 from public.gbp_content_lineage_v1 l
      where l.restaurant_id = p_restaurant_id
        and l.external_profile_row_id = p_external_profile_row_id
        and l.connection_generation = p_connection_generation and l.consent_epoch = p_consent_epoch
        and l.store_key = 'restaurant_external_profile_snapshots'
        and l.source_row_id = s.id and l.expires_at > p_now)
  order by s.fetched_at desc, s.id;
$$;

create or replace function public.begin_gbp_dual_sync_snapshot_run_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_run_id uuid,
  p_run_kind text, p_started_at timestamptz
) returns public.dual_sync_snapshot_runs
language plpgsql security definer set search_path = public as $$
declare v_row public.dual_sync_snapshot_runs%rowtype;
begin
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id = p_external_account_id and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if not found then raise exception using errcode = '42501', message = 'stale GBP snapshot run fence'; end if;
  if p_run_kind not in ('manual','scheduled','core_write','location_link','preflight')
    or p_started_at < timezone('utc', now()) - interval '15 minutes'
    or p_started_at > timezone('utc', now()) + interval '1 minute' then
    raise exception using errcode = '22023', message = 'invalid GBP snapshot run envelope';
  end if;
  insert into public.dual_sync_snapshot_runs (
    id, restaurant_id, provider, run_kind, status, raw_payload,
    canonical_snapshot, snapshot_hash, error_code, error_message, started_at, finished_at
  ) values (p_run_id, p_restaurant_id, 'google_business_profile', p_run_kind,
    'pending', null, null, null, null, null, p_started_at, null)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.fail_gbp_dual_sync_snapshot_run_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_run_id uuid,
  p_run_kind text, p_error_code text, p_finished_at timestamptz
) returns public.dual_sync_snapshot_runs
language plpgsql security definer set search_path = public as $$
declare v_row public.dual_sync_snapshot_runs%rowtype;
begin
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id = p_external_account_id and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if not found then raise exception using errcode = '42501', message = 'stale GBP snapshot run fence'; end if;
  if p_error_code is null or p_error_code !~ '^[A-Z0-9_:-]{1,100}$' then
    raise exception using errcode = '22023', message = 'unsafe GBP snapshot error code';
  end if;
  update public.dual_sync_snapshot_runs
  set status = 'failed', error_code = p_error_code, error_message = null,
      raw_payload = null, canonical_snapshot = null, snapshot_hash = null,
      finished_at = p_finished_at
  where id = p_run_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile' and run_kind = p_run_kind
    and status = 'pending' and raw_payload is null and canonical_snapshot is null
  returning * into v_row;
  if not found then raise exception using errcode = '55000', message = 'snapshot run is not pending'; end if;
  return v_row;
end;
$$;

create or replace function public.persist_gbp_dual_sync_snapshot_run_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_run_id uuid,
  p_run_kind text, p_raw_payload jsonb, p_observed_at timestamptz
) returns public.dual_sync_snapshot_runs
language plpgsql security definer set search_path = public as $$
declare v_row public.dual_sync_snapshot_runs%rowtype; v_hash text;
begin
  if p_raw_payload is null then raise exception using errcode = '22023', message = 'raw snapshot is required'; end if;
  v_hash := encode(digest(p_raw_payload::text, 'sha256'), 'hex');
  update public.dual_sync_snapshot_runs
  set status = 'succeeded', raw_payload = p_raw_payload, canonical_snapshot = null,
      snapshot_hash = v_hash, error_code = null, error_message = null,
      finished_at = p_observed_at
  where id = p_run_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile' and run_kind = p_run_kind
    and status = 'pending' and raw_payload is null and canonical_snapshot is null
  returning * into v_row;
  if not found then
    raise exception using errcode = '55000', message = 'snapshot run is not an exact empty pending row';
  end if;
  perform * from public.record_gbp_content_observation_v1(
    p_restaurant_id, p_external_profile_row_id, p_external_account_id,
    p_external_profile_id, p_external_location_id, p_connection_generation,
    p_consent_epoch, 'dual_sync_snapshot_runs', p_run_id, array['raw_payload']::text[],
    array[v_hash]::text[], p_observed_at
  );
  return v_row;
end;
$$;

create or replace function public.get_current_gbp_dual_sync_snapshot_runs_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_run_kind text default null,
  p_now timestamptz default timezone('utc', now())
) returns setof public.dual_sync_snapshot_runs
language sql security definer set search_path = public stable as $$
  select s.* from public.dual_sync_snapshot_runs s
  join public.restaurant_external_profiles p on p.restaurant_id = s.restaurant_id
  where p.id = p_external_profile_row_id and p.restaurant_id = p_restaurant_id
    and p.external_account_id = p_external_account_id and p.external_profile_id = p_external_profile_id
    and p.external_location_id = p_external_location_id
    and p.connection_generation = p_connection_generation and p.consent_epoch = p_consent_epoch
    and (p_run_kind is null or s.run_kind = p_run_kind)
    and exists (select 1 from public.gbp_content_lineage_v1 l
      where l.restaurant_id = p_restaurant_id and l.external_profile_row_id = p_external_profile_row_id
        and l.connection_generation = p_connection_generation and l.consent_epoch = p_consent_epoch
        and l.store_key = 'dual_sync_snapshot_runs' and l.source_row_id = s.id
        and l.expires_at > p_now)
  order by s.started_at desc, s.id;
$$;

create or replace function public.persist_gbp_food_menu_snapshot_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_snapshot_id uuid,
  p_source text, p_food_menus_name text, p_raw_food_menus jsonb,
  p_google_etag text, p_observed_at timestamptz
) returns public.restaurant_gbp_food_menu_snapshots
language plpgsql security definer set search_path = public as $$
declare v_row public.restaurant_gbp_food_menu_snapshots%rowtype; v_hash text; v_fields text[]; v_hashes text[];
begin
  if p_raw_food_menus is null then raise exception using errcode = '22023', message = 'raw FoodMenus is required'; end if;
  v_hash := encode(digest(p_raw_food_menus::text, 'sha256'), 'hex');
  insert into public.restaurant_gbp_food_menu_snapshots (
    id, restaurant_id, external_profile_id, provider, snapshot_kind, source, status,
    food_menus_name, raw_food_menus, canonical_food_menus, projection_metadata,
    snapshot_hash, google_etag, pulled_at
  ) values (p_snapshot_id, p_restaurant_id, p_external_profile_row_id,
    'google_business_profile', 'google_pull', p_source, 'succeeded', p_food_menus_name,
    p_raw_food_menus, null, '{}'::jsonb, v_hash, p_google_etag, p_observed_at)
  returning * into v_row;
  v_fields := case when p_food_menus_name is null then array['raw_food_menus']::text[]
    else array['food_menus_name','raw_food_menus']::text[] end;
  v_hashes := case when p_food_menus_name is null then array[v_hash]::text[]
    else array[encode(digest(p_food_menus_name, 'sha256'), 'hex'),v_hash]::text[] end;
  perform * from public.record_gbp_content_observation_v1(
    p_restaurant_id, p_external_profile_row_id, p_external_account_id,
    p_external_profile_id, p_external_location_id, p_connection_generation,
    p_consent_epoch, 'restaurant_gbp_food_menu_snapshots', p_snapshot_id,
    v_fields, v_hashes, p_observed_at
  );
  return v_row;
end;
$$;

create or replace function public.get_current_gbp_food_menu_snapshots_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_now timestamptz default timezone('utc', now())
) returns setof public.restaurant_gbp_food_menu_snapshots
language sql security definer set search_path = public stable as $$
  select s.* from public.restaurant_gbp_food_menu_snapshots s
  join public.restaurant_external_profiles p
    on p.id = s.external_profile_id and p.restaurant_id = s.restaurant_id
  where p.id = p_external_profile_row_id and p.restaurant_id = p_restaurant_id
    and p.external_account_id = p_external_account_id and p.external_profile_id = p_external_profile_id
    and p.external_location_id = p_external_location_id
    and p.connection_generation = p_connection_generation and p.consent_epoch = p_consent_epoch
    and exists (select 1 from public.gbp_content_lineage_v1 l
      where l.restaurant_id = p_restaurant_id and l.external_profile_row_id = p_external_profile_row_id
        and l.connection_generation = p_connection_generation and l.consent_epoch = p_consent_epoch
        and l.store_key = 'restaurant_gbp_food_menu_snapshots' and l.source_row_id = s.id
        and l.expires_at > p_now)
  order by s.pulled_at desc, s.id;
$$;

create or replace function public.run_gbp_content_retention_v1(
  p_now timestamptz, p_limit integer, p_time_budget_ms integer, p_dry_run boolean,
  p_restaurant_id uuid default null, p_external_profile_row_id uuid default null,
  p_connection_generation bigint default null, p_consent_epoch bigint default null
) returns setof public.gbp_content_retention_result_v1
language plpgsql security definer set search_path = public as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_store_key text; v_action text; v_matched bigint; v_mutated bigint; v_step bigint;
  v_oldest timestamptz; v_lineage_ids uuid[]; v_source_ids uuid[];
  v_remaining integer := p_limit; v_result public.gbp_content_retention_result_v1;
begin
  if p_limit < 1 or p_limit > 5000 or p_time_budget_ms < 100 or p_time_budget_ms > 30000 then
    raise exception using errcode = '22023', message = 'invalid GBP retention bounds';
  end if;
  if p_external_profile_row_id is not null then
    if p_restaurant_id is null or p_connection_generation is null or p_consent_epoch is null then
      raise exception using errcode = '22023', message = 'incomplete GBP retention fence';
    end if;
    perform 1 from public.restaurant_external_profiles
    where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
      and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    for update;
    if not found then raise no_data_found; end if;
  end if;
  perform set_config('app.gbp_retention_scrub', 'on', true);

  for v_store_key, v_action in select * from (values
    ('dual_sync_jobs','scrub'), ('dual_sync_outbound_candidates','delete'),
    ('dual_sync_publish_operations','scrub'), ('dual_sync_google_request_logs','scrub'),
    ('dual_sync_google_request_log_archives','delete'),
    ('restaurant_gbp_food_menu_import_reviews','delete'),
    ('restaurant_gbp_food_menu_publish_attempts','scrub'), ('gbp_sync_v2_drafts','delete'),
    ('restaurant_external_profile_sync_runs','scrub'),
    ('gbp_sync_v2_publish_jobs','scrub'), ('gbp_sync_v2_publish_events','scrub'),
    ('gbp_sync_v2_decisions','scrub'), ('dual_sync_field_states','scrub'),
    ('dual_sync_publish_batches','scrub'), ('dual_sync_publish_operation_groups','scrub'),
    ('restaurant_categories','scrub'), ('restaurant_service_areas','scrub'),
    ('restaurant_attributes','scrub'), ('restaurant_service_items','scrub'),
    ('restaurant_addresses','scrub'), ('restaurant_phone_numbers','scrub'),
    ('restaurant_links','scrub'), ('restaurant_hours','scrub'),
    ('restaurant_gbp_food_menu_projected_identities','delete'),
    ('restaurant_gbp_food_menu_snapshots','delete'),
    ('dual_sync_snapshot_runs','delete'),
    ('restaurant_external_profile_snapshots','delete'),
    ('gbp_field_provenance_v1','metadata_only')
  ) stores(store_key, action)
  loop
    v_matched := 0; v_mutated := 0; v_oldest := null;
    v_lineage_ids := array[]::uuid[]; v_source_ids := array[]::uuid[];
    select count(distinct source_row_id), min(expires_at) into v_matched, v_oldest
    from public.gbp_content_lineage_v1
    where store_key = v_store_key and expires_at <= p_now
      and (p_restaurant_id is null or restaurant_id = p_restaurant_id)
      and (p_external_profile_row_id is null or external_profile_row_id = p_external_profile_row_id)
      and (p_connection_generation is null or connection_generation = p_connection_generation)
      and (p_consent_epoch is null or consent_epoch = p_consent_epoch);
    if not p_dry_run and v_remaining > 0 and v_matched > 0 then
      select coalesce(array_agg(id), array[]::uuid[]),
        coalesce(array_agg(source_row_id), array[]::uuid[])
      into v_lineage_ids, v_source_ids from (
        select id, source_row_id from public.gbp_content_lineage_v1
        where store_key = v_store_key and expires_at <= p_now
          and (p_restaurant_id is null or restaurant_id = p_restaurant_id)
          and (p_external_profile_row_id is null or external_profile_row_id = p_external_profile_row_id)
          and (p_connection_generation is null or connection_generation = p_connection_generation)
          and (p_consent_epoch is null or consent_epoch = p_consent_epoch)
        order by expires_at, id for update skip locked limit v_remaining
      ) targets;
      if cardinality(v_lineage_ids) > 0 then
        if v_store_key = 'restaurant_external_profile_snapshots' then
          delete from public.restaurant_external_profile_snapshots where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_snapshot_runs' then
          delete from public.dual_sync_snapshot_runs where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_jobs' then
          update public.dual_sync_jobs set payload = '{}'::jsonb,
            last_error_message = null, dead_letter_reason = null where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_outbound_candidates' then
          delete from public.dual_sync_outbound_candidates where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_publish_operations' then
          update public.dual_sync_publish_operations set external_response = null,
            error_message = null where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_google_request_logs' then
          update public.dual_sync_google_request_logs set request_summary = '{}'::jsonb,
            response_summary = null, error_message = null where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_google_request_log_archives' then
          delete from public.dual_sync_google_request_log_archives where id = any(v_source_ids);
        elsif v_store_key = 'restaurant_gbp_food_menu_snapshots' then
          delete from public.restaurant_gbp_food_menu_snapshots where id = any(v_source_ids);
        elsif v_store_key = 'restaurant_gbp_food_menu_import_reviews' then
          delete from public.restaurant_gbp_food_menu_import_reviews where id = any(v_source_ids);
        elsif v_store_key = 'restaurant_gbp_food_menu_publish_attempts' then
          update public.restaurant_gbp_food_menu_publish_attempts
          set projected_payload = '{}'::jsonb, google_response = null, error_message = null
          where id = any(v_source_ids);
        elsif v_store_key = 'restaurant_external_profile_sync_runs' then
          update public.restaurant_external_profile_sync_runs
          set metadata = null, error_message = null where id = any(v_source_ids);
        elsif v_store_key = 'gbp_sync_v2_drafts' then
          delete from public.gbp_sync_v2_drafts where id = any(v_source_ids);
        elsif v_store_key = 'gbp_sync_v2_publish_jobs' then
          update public.gbp_sync_v2_publish_jobs set payload = '{}'::jsonb,
            error_message = null where id = any(v_source_ids);
        elsif v_store_key = 'gbp_sync_v2_publish_events' then
          update public.gbp_sync_v2_publish_events set event_payload = '{}'::jsonb
          where id = any(v_source_ids);
        elsif v_store_key = 'gbp_sync_v2_decisions' then
          update public.gbp_sync_v2_decisions set current_value = null, proposed_value = null
          where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_field_states' then
          update public.dual_sync_field_states set metadata = '{}'::jsonb,
            gbp_value_hash = null, last_gbp_change_at = null where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_publish_batches' then
          update public.dual_sync_publish_batches set plan_summary = '{}'::jsonb,
            error_message = null where id = any(v_source_ids);
        elsif v_store_key = 'dual_sync_publish_operation_groups' then
          update public.dual_sync_publish_operation_groups set preflight_result = null,
            request_summary = null, response_summary = null, error_message = null
          where id = any(v_source_ids);
        elsif v_store_key = 'restaurant_categories' then
          delete from public.restaurant_categories
          where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
          update public.restaurant_categories c set
            category_code = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = c.id and l.content_field = 'category_code') then null else c.category_code end,
            more_hours_types_json = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = c.id and l.content_field = 'more_hours_types_json') then '[]'::jsonb else c.more_hours_types_json end,
            source_record_id = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = c.id and l.content_field = 'source_record_id') then null else c.source_record_id end
          where c.id = any(v_source_ids) and not (c.source = 'gbp' and c.managed_by = 'gbp')
            and exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = c.id and l.content_field in ('category_code','more_hours_types_json','source_record_id'));
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
        elsif v_store_key = 'restaurant_service_areas' then
          delete from public.restaurant_service_areas
          where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
          update public.restaurant_service_areas s set
            region_code = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'region_code') then null else s.region_code end,
            place_data_json = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'place_data_json') then '{}'::jsonb else s.place_data_json end,
            source_record_id = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'source_record_id') then null else s.source_record_id end
          where s.id = any(v_source_ids) and not (s.source = 'gbp' and s.managed_by = 'gbp')
            and exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field in ('region_code','place_data_json','source_record_id'));
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
        elsif v_store_key = 'restaurant_attributes' then
          delete from public.restaurant_attributes
          where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
          update public.restaurant_attributes a set
            display_name = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'display_name') then null else a.display_name end,
            bool_value = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'bool_value') then null else a.bool_value end,
            text_value = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'text_value') then null else a.text_value end,
            uri_value = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'uri_value') then null else a.uri_value end,
            enum_values = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'enum_values') then '[]'::jsonb else a.enum_values end,
            value_metadata_json = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'value_metadata_json') then '[]'::jsonb else a.value_metadata_json end,
            display_text = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'display_text') then null else a.display_text end,
            display_text_standalone = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'display_text_standalone') then null else a.display_text_standalone end,
            display_text_negative = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'display_text_negative') then null else a.display_text_negative end,
            source_record_id = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field = 'source_record_id') then null else a.source_record_id end
          where a.id = any(v_source_ids) and not (a.source = 'gbp' and a.managed_by = 'gbp')
            and exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = a.id and l.content_field in ('display_name','bool_value','text_value','uri_value','enum_values','value_metadata_json','display_text','display_text_standalone','display_text_negative','source_record_id'));
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
        elsif v_store_key = 'restaurant_service_items' then
          delete from public.restaurant_service_items
          where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
          update public.restaurant_service_items s set
            display_name = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'display_name') then null else s.display_name end,
            description = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'description') then null else s.description end,
            payload_json = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'payload_json') then '{}'::jsonb else s.payload_json end,
            source_record_id = case when exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field = 'source_record_id') then null else s.source_record_id end
          where s.id = any(v_source_ids) and not (s.source = 'gbp' and s.managed_by = 'gbp')
            and exists (select 1 from public.gbp_content_lineage_v1 l where l.id = any(v_lineage_ids) and l.source_row_id = s.id and l.content_field in ('display_name','description','payload_json','source_record_id'));
          get diagnostics v_step = row_count; v_mutated := v_mutated + v_step;
        elsif v_store_key = 'restaurant_addresses' then
          delete from public.restaurant_addresses where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
        elsif v_store_key = 'restaurant_phone_numbers' then
          delete from public.restaurant_phone_numbers where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
        elsif v_store_key = 'restaurant_links' then
          delete from public.restaurant_links where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
        elsif v_store_key = 'restaurant_hours' then
          delete from public.restaurant_hours where id = any(v_source_ids) and source = 'gbp' and managed_by = 'gbp';
        elsif v_store_key = 'restaurant_gbp_food_menu_projected_identities' then
          delete from public.restaurant_gbp_food_menu_projected_identities where id = any(v_source_ids);
        end if;
        if v_store_key not in ('restaurant_categories','restaurant_service_areas','restaurant_attributes','restaurant_service_items') then
          get diagnostics v_mutated = row_count;
        end if;
        delete from public.gbp_content_lineage_v1 where id = any(v_lineage_ids);
        v_remaining := greatest(0, v_remaining - cardinality(v_lineage_ids));
      end if;
    end if;
    v_result := row(v_store_key, v_action, v_matched, v_mutated, v_oldest,
      v_matched > case when p_dry_run then p_limit else v_mutated end
      or v_remaining = 0
      or extract(epoch from clock_timestamp() - v_started_at) * 1000 >= p_time_budget_ms);
    return next v_result;
    exit when extract(epoch from clock_timestamp() - v_started_at) * 1000 >= p_time_budget_ms;
  end loop;

  select count(*), min(retention_expires_at) into v_matched, v_oldest
  from public.dual_sync_google_request_log_archives
  where retention_expires_at <= p_now
    and (p_restaurant_id is null or restaurant_id = p_restaurant_id);
  v_mutated := 0;
  if not p_dry_run and v_remaining > 0 and v_matched > 0 then
    with targets as (
      select id from public.dual_sync_google_request_log_archives
      where retention_expires_at <= p_now
        and (p_restaurant_id is null or restaurant_id = p_restaurant_id)
      order by retention_expires_at, id for update skip locked limit v_remaining
    ) delete from public.dual_sync_google_request_log_archives a
      using targets where a.id = targets.id;
    get diagnostics v_mutated = row_count;
  end if;
  v_result := row('dual_sync_google_request_log_archives', 'delete', v_matched,
    v_mutated, v_oldest, v_matched > case when p_dry_run then p_limit else v_mutated end);
  return next v_result;
  perform set_config('app.gbp_retention_scrub', 'off', true);
end;
$$;

create or replace function public.purge_gbp_profile_content_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_count bigint;
begin
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and external_account_id is not distinct from p_external_account_id
    and external_profile_id is not distinct from p_external_profile_id
    and external_location_id is not distinct from p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    and write_state = 'revoking' for update;
  if not found then raise no_data_found; end if;
  select count(*) into v_count from public.gbp_content_lineage_v1
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch;
  perform * from public.run_gbp_content_retention_v1(
    'infinity'::timestamptz, 5000, 30000, false, p_restaurant_id,
    p_external_profile_row_id, p_connection_generation, p_consent_epoch
  );
  if exists (select 1 from public.gbp_content_lineage_v1
    where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
      and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch) then
    raise exception using errcode = '54000', message = 'GBP profile purge exceeds bounded batch';
  end if;
  delete from public.gbp_field_provenance_v1 where restaurant_id = p_restaurant_id
    and external_profile_row_id = p_external_profile_row_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch;
  return v_count;
end;
$$;

create table public.gbp_core_change_outbox_v1 (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source_table text not null,
  source_row_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  field_keys text[] not null,
  before_hash text,
  after_hash text,
  idempotency_hash text not null check (idempotency_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default timezone('utc', now()),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  lease_token uuid,
  last_error_code text,
  completed_at timestamptz,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint gbp_core_change_outbox_v1_status_check
    check (status in ('pending', 'claimed', 'completed', 'dead_letter')),
  constraint gbp_core_change_outbox_v1_attempts_check
    check (max_attempts between 1 and 25 and attempt_count between 0 and max_attempts),
  constraint gbp_core_change_outbox_v1_fields_check check (
    cardinality(field_keys) > 0
    and array_position(field_keys, null) is null
    and field_keys = public.array_sort_unique_text(field_keys)
  ),
  constraint gbp_core_change_outbox_v1_hashes_check check (
    (before_hash is null or before_hash ~ '^[a-f0-9]{64}$')
    and (after_hash is null or after_hash ~ '^[a-f0-9]{64}$')
    and ((operation = 'INSERT' and before_hash is null and after_hash is not null)
      or (operation = 'UPDATE' and before_hash is not null and after_hash is not null)
      or (operation = 'DELETE' and before_hash is not null and after_hash is null))
  ),
  constraint gbp_core_change_outbox_v1_worker_check
    check (claimed_by is null or claimed_by ~ '^[A-Za-z0-9._:-]{1,100}$'),
  constraint gbp_core_change_outbox_v1_error_check check (
    last_error_code is null or last_error_code in (
      'lease_expired', 'lease_expired_exhausted', 'provider_error',
      'transient_error', 'rate_limited', 'timeout', 'stale_fence',
      'invalid_manifest', 'policy_blocked', 'reconciliation_required',
      'operator_repair', 'unknown'
    )
  ),
  constraint gbp_core_change_outbox_v1_state_check check (
    (status = 'pending' and claimed_by is null and claimed_at is null
      and lease_expires_at is null and lease_token is null
      and completed_at is null and dead_lettered_at is null)
    or (status = 'claimed' and claimed_by is not null and claimed_at is not null
      and lease_expires_at > claimed_at and lease_token is not null
      and completed_at is null and dead_lettered_at is null)
    or (status = 'completed' and completed_at is not null
      and claimed_by is null and claimed_at is null and lease_expires_at is null
      and lease_token is null and dead_lettered_at is null)
    or (status = 'dead_letter' and dead_lettered_at is not null
      and claimed_by is null and claimed_at is null and lease_expires_at is null
      and lease_token is null and completed_at is null)
  ),
  unique (idempotency_hash),
  unique (restaurant_id, id, idempotency_hash)
);
create index gbp_core_change_outbox_v1_claim_idx on public.gbp_core_change_outbox_v1 (status, available_at, created_at, id) where status = 'pending';
create index gbp_core_change_outbox_v1_lease_idx on public.gbp_core_change_outbox_v1 (lease_expires_at, id) where status = 'claimed';
create index gbp_core_change_outbox_v1_restaurant_idx on public.gbp_core_change_outbox_v1 (restaurant_id, created_at, id);

create type public.gbp_core_outbox_census_v1 as (
  pending_available bigint,
  pending_delayed bigint,
  claimed bigint,
  stale_claimed bigint,
  dead_letter bigint,
  completed bigint,
  oldest_outstanding_age_seconds bigint
);

create or replace function public.enqueue_gbp_core_change_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
  v_source_row_id uuid := coalesce(
    nullif(to_jsonb(new) ->> 'id', '')::uuid,
    nullif(to_jsonb(old) ->> 'id', '')::uuid,
    v_restaurant_id
  );
  v_provider_import_fence text := current_setting('app.gbp_provider_import_fence', true);
  v_semantic_field text := case tg_table_name
    when 'restaurant_addresses' then 'profile.address'
    when 'restaurant_phone_numbers' then 'profile.contactPhone'
    when 'restaurant_links' then case coalesce(to_jsonb(new) ->> 'link_type', to_jsonb(old) ->> 'link_type')
      when 'google_map' then 'profile.googleMapUrl'
      when 'google_review' then 'profile.googleReviewUrl'
    end
  end;
  v_before_hash text;
  v_after_hash text;
  v_field_keys text[];
  v_created_at timestamptz := timezone('utc', now());
begin
  if v_semantic_field is not null
    and v_provider_import_fence = v_restaurant_id::text || ':' || v_semantic_field then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_table_name in ('restaurant_addresses', 'restaurant_phone_numbers') then
    perform set_config(
      'app.gbp_projection_coalesce_fence',
      v_restaurant_id::text || ':' || case tg_table_name
        when 'restaurant_addresses' then 'address' else 'contact_phone' end,
      true
    );
  end if;
  if coalesce(to_jsonb(new) ->> 'source', '') = 'gbp'
    or coalesce(to_jsonb(old) ->> 'source', '') = 'gbp'
    or coalesce(to_jsonb(new) ->> 'change_origin', '') = 'google'
    or coalesce(to_jsonb(old) ->> 'change_origin', '') = 'google' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op <> 'INSERT' then
    v_before_hash := encode(digest(to_jsonb(old)::text, 'sha256'), 'hex');
  end if;
  if tg_op <> 'DELETE' then
    v_after_hash := encode(digest(to_jsonb(new)::text, 'sha256'), 'hex');
  end if;
  select array_agg(key order by key) into v_field_keys
  from (
    select key from jsonb_object_keys(coalesce(to_jsonb(new), '{}'::jsonb) || coalesce(to_jsonb(old), '{}'::jsonb)) as keys(key)
    where coalesce(to_jsonb(new), '{}'::jsonb) -> key is distinct from coalesce(to_jsonb(old), '{}'::jsonb) -> key
  ) changed;
  if cardinality(v_field_keys) is null or cardinality(v_field_keys) = 0 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  insert into public.gbp_core_change_outbox_v1 (
    restaurant_id, source_table, source_row_id, operation, field_keys,
    before_hash, after_hash, idempotency_hash, created_at
  ) values (
    v_restaurant_id, tg_table_name, v_source_row_id, tg_op, v_field_keys,
    v_before_hash, v_after_hash,
    encode(digest(concat_ws(':', v_restaurant_id::text, tg_table_name, v_source_row_id::text, tg_op, coalesce(v_before_hash, ''), coalesce(v_after_hash, '')), 'sha256'), 'hex'),
    v_created_at
  ) on conflict (idempotency_hash) do nothing;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enqueue_gbp_restaurants_change_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_field_keys text[];
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_projection_fence text := current_setting('app.gbp_projection_coalesce_fence', true);
  v_before_hash text;
  v_after_hash text;
begin
  if tg_op = 'DELETE' then return old; end if;
  select array_agg(column_name order by column_name) into v_field_keys
  from unnest(array['address', 'contact_phone', 'google_map_url', 'google_review_url', 'name']) column_name
  where (tg_op = 'INSERT' or to_jsonb(new) -> column_name is distinct from to_jsonb(old) -> column_name)
    and v_projection_fence is distinct from new.id::text || ':' || column_name;
  if v_projection_fence like new.id::text || ':%' then
    perform set_config('app.gbp_projection_coalesce_fence', '', true);
  end if;
  if cardinality(v_field_keys) is null or cardinality(v_field_keys) = 0 then
    return new;
  end if;
  select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key order by key), '{}'::jsonb),
         coalesce(jsonb_object_agg(key, to_jsonb(new) -> key order by key), '{}'::jsonb)
  into v_before, v_after from unnest(v_field_keys) key;
  if tg_op <> 'INSERT' then v_before_hash := encode(digest(v_before::text, 'sha256'), 'hex'); end if;
  v_after_hash := encode(digest(v_after::text, 'sha256'), 'hex');
  insert into public.gbp_core_change_outbox_v1 (
    restaurant_id, source_table, source_row_id, operation, field_keys,
    before_hash, after_hash, idempotency_hash
  ) values (
    new.id, tg_table_name, new.id, tg_op, v_field_keys, v_before_hash, v_after_hash,
    encode(digest(concat_ws(':', new.id::text, tg_table_name, new.id::text,
      tg_op, coalesce(v_before_hash, ''), v_after_hash), 'sha256'), 'hex')
  ) on conflict (idempotency_hash) do nothing;
  return new;
end;
$$;

create or replace function public.enqueue_gbp_operating_hours_change_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
  v_source_row_id uuid := coalesce(new.id, old.id);
  v_field_keys text[];
  v_before_hash text;
  v_after_hash text;
begin
  if tg_op = 'UPDATE'
    and to_jsonb(new) - array['updated_at']::text[]
      is not distinct from to_jsonb(old) - array['updated_at']::text[] then
    return new;
  end if;
  select array_agg(key order by key) into v_field_keys from (
    select distinct 'weekly_' || day_value::text as key
    from (values
      (case when tg_op <> 'INSERT' and old.effective_date is null then old.day_of_week end),
      (case when tg_op <> 'DELETE' and new.effective_date is null then new.day_of_week end)
    ) days(day_value)
    where day_value between 0 and 6
  ) changed_days;
  if cardinality(v_field_keys) is null or cardinality(v_field_keys) = 0 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op <> 'INSERT' then v_before_hash := encode(digest(to_jsonb(old)::text, 'sha256'), 'hex'); end if;
  if tg_op <> 'DELETE' then v_after_hash := encode(digest(to_jsonb(new)::text, 'sha256'), 'hex'); end if;
  insert into public.gbp_core_change_outbox_v1 (
    restaurant_id, source_table, source_row_id, operation, field_keys,
    before_hash, after_hash, idempotency_hash
  ) values (
    v_restaurant_id, tg_table_name, v_source_row_id, tg_op, v_field_keys,
    v_before_hash, v_after_hash,
    encode(digest(concat_ws(':', v_restaurant_id::text, tg_table_name,
      v_source_row_id::text, tg_op, coalesce(v_before_hash, ''),
      coalesce(v_after_hash, '')), 'sha256'), 'hex')
  ) on conflict (idempotency_hash) do nothing;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enqueue_gbp_service_period_change_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid := coalesce(new.restaurant_id, old.restaurant_id);
  v_source_row_id uuid := coalesce(new.id, old.id);
  v_before_hash text;
  v_after_hash text;
begin
  if tg_op = 'UPDATE'
    and to_jsonb(new) - array['updated_at']::text[]
      is not distinct from to_jsonb(old) - array['updated_at']::text[] then
    return new;
  end if;
  if tg_op <> 'INSERT' then v_before_hash := encode(digest(to_jsonb(old)::text, 'sha256'), 'hex'); end if;
  if tg_op <> 'DELETE' then v_after_hash := encode(digest(to_jsonb(new)::text, 'sha256'), 'hex'); end if;
  insert into public.gbp_core_change_outbox_v1 (
    restaurant_id, source_table, source_row_id, operation, field_keys,
    before_hash, after_hash, idempotency_hash
  ) values (
    v_restaurant_id, tg_table_name, v_source_row_id, tg_op,
    array['service_periods']::text[], v_before_hash, v_after_hash,
    encode(digest(concat_ws(':', v_restaurant_id::text, tg_table_name,
      v_source_row_id::text, tg_op, coalesce(v_before_hash, ''),
      coalesce(v_after_hash, '')), 'sha256'), 'hex')
  ) on conflict (idempotency_hash) do nothing;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger restaurant_business_details_gbp_core_outbox after insert or update or delete on public.restaurant_business_details for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_addresses_gbp_core_outbox after insert or update or delete on public.restaurant_addresses for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_phone_numbers_gbp_core_outbox after insert or update or delete on public.restaurant_phone_numbers for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_links_gbp_core_outbox after insert or update or delete on public.restaurant_links for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_categories_gbp_core_outbox after insert or update or delete on public.restaurant_categories for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_service_areas_gbp_core_outbox after insert or update or delete on public.restaurant_service_areas for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_hours_gbp_core_outbox after insert or update or delete on public.restaurant_hours for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_attributes_gbp_core_outbox after insert or update or delete on public.restaurant_attributes for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurant_service_items_gbp_core_outbox after insert or update or delete on public.restaurant_service_items for each row execute function public.enqueue_gbp_core_change_v1();
create trigger restaurants_gbp_core_outbox after insert or update on public.restaurants for each row execute function public.enqueue_gbp_restaurants_change_v1();
create trigger restaurant_operating_hours_gbp_core_outbox after insert or update or delete on public.restaurant_operating_hours for each row execute function public.enqueue_gbp_operating_hours_change_v1();
create trigger restaurant_service_periods_gbp_core_outbox after insert or update or delete on public.restaurant_service_periods for each row execute function public.enqueue_gbp_service_period_change_v1();

create or replace function public.apply_gbp_profile_import_to_core_v1(
  p_restaurant_id uuid,
  p_external_profile_row_id uuid,
  p_expected_account_id text,
  p_expected_profile_id text,
  p_expected_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint,
  p_field_key text,
  p_value text
) returns public.restaurants
language plpgsql security definer set search_path = public as $$
declare
  v_profile public.restaurant_external_profiles%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_column_name text;
begin
  if p_expected_account_id is null or p_expected_profile_id is null
    or p_expected_location_id is null or p_connection_generation <= 0
    or p_consent_epoch <= 0 or p_field_key not in (
      'profile.name', 'profile.contactPhone', 'profile.address',
      'profile.googleMapUrl', 'profile.googleReviewUrl'
    ) or (p_field_key = 'profile.name' and nullif(btrim(p_value), '') is null) then
    raise exception using errcode = '22023', message = 'invalid GBP profile import field or value';
  end if;

  select * into v_profile
  from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
  for update;
  if not found
    or v_profile.provider <> 'google_business_profile'
    or v_profile.external_account_id is distinct from p_expected_account_id
    or v_profile.external_profile_id is distinct from p_expected_profile_id
    or v_profile.external_location_id is distinct from p_expected_location_id
    or v_profile.connection_generation <> p_connection_generation
    or v_profile.consent_epoch <> p_consent_epoch
    or v_profile.write_state in ('disconnected', 'reauth_required') then
    raise exception using errcode = 'P0001', message = 'GBP profile import fence mismatch';
  end if;

  select * into strict v_restaurant from public.restaurants
  where id = p_restaurant_id for update;
  v_column_name := case p_field_key
    when 'profile.name' then 'name'
    when 'profile.contactPhone' then 'contact_phone'
    when 'profile.address' then 'address'
    when 'profile.googleMapUrl' then 'google_map_url'
    when 'profile.googleReviewUrl' then 'google_review_url'
  end;
  perform set_config(
    'app.gbp_projection_coalesce_fence', p_restaurant_id::text || ':' || v_column_name, true
  );
  perform set_config(
    'app.gbp_provider_import_fence', p_restaurant_id::text || ':' || p_field_key, true
  );

  if p_field_key = 'profile.name' then
    update public.restaurants set name = btrim(p_value) where id = p_restaurant_id returning * into v_restaurant;
  elsif p_field_key = 'profile.contactPhone' then
    update public.restaurants set contact_phone = p_value where id = p_restaurant_id returning * into v_restaurant;
    delete from public.restaurant_phone_numbers
    where restaurant_id = p_restaurant_id and source = 'nabatable'
      and managed_by = 'nabatable' and phone_kind = 'primary';
  elsif p_field_key = 'profile.address' then
    update public.restaurants set address = p_value where id = p_restaurant_id returning * into v_restaurant;
    delete from public.restaurant_addresses
    where restaurant_id = p_restaurant_id and source = 'nabatable'
      and managed_by = 'nabatable' and address_type = 'storefront';
  elsif p_field_key = 'profile.googleMapUrl' then
    update public.restaurants set google_map_url = p_value where id = p_restaurant_id returning * into v_restaurant;
    delete from public.restaurant_links
    where restaurant_id = p_restaurant_id and source = 'nabatable'
      and managed_by = 'nabatable' and link_type = 'google_map' and link_status = 'current';
  else
    update public.restaurants set google_review_url = p_value where id = p_restaurant_id returning * into v_restaurant;
    delete from public.restaurant_links
    where restaurant_id = p_restaurant_id and source = 'nabatable'
      and managed_by = 'nabatable' and link_type = 'google_review' and link_status = 'current';
  end if;
  return v_restaurant;
end;
$$;

alter table public.dual_sync_jobs
  add column if not exists external_profile_id text,
  add column if not exists external_account_id text,
  add column if not exists external_location_id text,
  add column if not exists connection_generation bigint,
  add column if not exists consent_epoch bigint,
  add column if not exists idempotency_key text,
  add column if not exists write_bundle_id uuid,
  add column if not exists execution_id uuid;
update public.dual_sync_jobs
set status = 'cancelled', finished_at = timezone('utc', now()),
    last_error_code = 'legacy_unfenced_write_job'
where provider = 'google_business_profile'
  and job_kind in ('publish_batch', 'auto_export')
  and status in ('queued', 'running', 'retrying')
  and (external_profile_id is null or external_account_id is null or
       external_location_id is null or connection_generation is null or consent_epoch is null);
alter table public.dual_sync_jobs add constraint dual_sync_jobs_gbp_publish_once_v1_check
  check (write_bundle_id is null or (job_kind = 'publish_batch' and max_attempts = 1 and external_profile_id is not null and external_account_id is not null and external_location_id is not null and connection_generation > 0 and consent_epoch > 0));
update public.dual_sync_jobs set max_attempts = 1
where provider = 'google_business_profile' and job_kind in ('publish_batch', 'auto_export');
alter table public.dual_sync_jobs add constraint dual_sync_jobs_gbp_mutation_once_v1_check
  check (provider <> 'google_business_profile' or job_kind not in ('publish_batch', 'auto_export') or max_attempts = 1);
create index dual_sync_jobs_gbp_fence_v1_idx on public.dual_sync_jobs (restaurant_id, external_profile_id, external_location_id, connection_generation, consent_epoch, status) where external_profile_id is not null;
create unique index dual_sync_jobs_gbp_idempotency_v1_idx
  on public.dual_sync_jobs (restaurant_id, provider, job_kind, idempotency_key)
  where idempotency_key is not null;

create type public.gbp_write_grant_issue_v1 as (
  grant_id uuid,
  direction text,
  field_keys text[],
  group_id text,
  write_group text,
  google_method text,
  google_resource text,
  update_masks text[],
  update_masks_hash text,
  before_hashes text[],
  after_hashes text[],
  request_hash text,
  decision_hash text,
  core_snapshot_hash text,
  google_snapshot_hash text,
  preview_fingerprint text,
  risk_acknowledgements text[],
  manifest_hash text,
  bundle_order integer
);

create type public.gbp_write_bundle_enqueue_result_v1 as (
  grants public.gbp_write_grants_v1[],
  job_id uuid,
  job_status text,
  job_payload jsonb
);

create or replace function public.guard_gbp_mutation_job_v1()
returns trigger language plpgsql set search_path = public as $$
declare
  v_keys text[];
begin
  if new.provider <> 'google_business_profile' or new.job_kind not in ('publish_batch', 'auto_export') then
    return new;
  end if;
  if tg_op = 'UPDATE' and current_setting('app.gbp_retention_scrub', true) = 'on' then
    if (to_jsonb(new) - array['payload','last_error_message','dead_letter_reason']::text[])
      is distinct from
      (to_jsonb(old) - array['payload','last_error_message','dead_letter_reason']::text[]) then
      raise exception using errcode = '55000', message = 'GBP retention may scrub content columns only';
    end if;
    return new;
  end if;
  if new.max_attempts <> 1 or new.attempt_count > 1 or new.status = 'retrying' then
    raise exception using errcode = '55000', message = 'GBP mutation jobs are single attempt';
  end if;
  if tg_op = 'UPDATE' then
    if old.status in ('succeeded', 'failed', 'dead_letter', 'cancelled')
      and new.status is distinct from old.status then
      raise exception using errcode = '55000', message = 'terminal GBP mutation job cannot be reset';
    end if;
    if (new.restaurant_id, new.provider, new.job_kind, new.payload, new.max_attempts,
        new.external_profile_id, new.external_account_id, new.external_location_id,
        new.connection_generation, new.consent_epoch, new.write_bundle_id)
      is distinct from
       (old.restaurant_id, old.provider, old.job_kind, old.payload, old.max_attempts,
        old.external_profile_id, old.external_account_id, old.external_location_id,
        old.connection_generation, old.consent_epoch, old.write_bundle_id) then
      raise exception using errcode = '55000', message = 'GBP mutation job identity is immutable';
    end if;
    if new.status = 'cancelled'
      and (to_jsonb(new) - array['status','finished_at','last_error_code']::text[])
        is not distinct from
        (to_jsonb(old) - array['status','finished_at','last_error_code']::text[]) then
      return new;
    end if;
  end if;
  if new.write_bundle_id is not null then
    select array_agg(key order by key) into v_keys from jsonb_object_keys(new.payload) key;
    if jsonb_typeof(new.payload) <> 'object' or v_keys is distinct from array[
      'bundle_hash', 'bundle_id', 'confirmation_version', 'connection_generation', 'consent_epoch', 'expires_at',
      'external_account_id', 'external_location_id', 'external_profile_id',
      'external_profile_row_id',
      'grant_ids', 'groups', 'manifest_hashes', 'policy_version',
      'renderer_version', 'restaurant_id'
    ]::text[] then
      raise exception using errcode = '22023', message = 'GBP mutation job payload is not hash-only allowlisted metadata';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status in ('queued', 'retrying') and new.write_bundle_id is not null
    and exists (
      select 1 from public.gbp_write_grants_v1
      where restaurant_id = new.restaurant_id and bundle_id = new.write_bundle_id
        and status in ('dispatched', 'consumed', 'failed', 'outcome_unknown',
                       'expired', 'revoked', 'cancelled_after_bundle_failure')
    ) then
    raise exception using errcode = '55000', message = 'dispatched or terminal GBP mutation cannot be retried';
  end if;
  return new;
end;
$$;

create trigger dual_sync_jobs_gbp_mutation_guard_v1
before insert or update on public.dual_sync_jobs
for each row execute function public.guard_gbp_mutation_job_v1();

create or replace function public.issue_gbp_write_bundle_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_actor_user_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_bundle_id uuid,
  p_bundle_hash text, p_policy_version text, p_renderer_version text,
  p_issued_at timestamptz, p_expires_at timestamptz,
  p_grants public.gbp_write_grant_issue_v1[]
) returns setof public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_connection public.restaurant_external_profiles%rowtype;
  v_item public.gbp_write_grant_issue_v1;
  v_count integer := cardinality(p_grants);
  v_mode text;
begin
  if v_count is null or v_count < 1 or v_count > 25
    or p_bundle_hash !~ '^[a-f0-9]{64}$'
    or p_issued_at > timezone('utc', now()) + interval '1 minute'
    or p_issued_at < timezone('utc', now()) - interval '15 minutes'
    or p_expires_at <= timezone('utc', now())
    or p_expires_at <= p_issued_at
    or p_expires_at > p_issued_at + interval '15 minutes' then
    raise exception using errcode = '22023', message = 'invalid GBP bundle envelope';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  select * into strict v_connection from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile' and write_state = 'eligible'
    and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if exists (
    select 1 from public.dual_sync_restaurant_controls
    where restaurant_id = p_restaurant_id and provider = 'google_business_profile' and sync_paused
  ) then
    raise exception using errcode = '42501', message = 'GBP sync is paused';
  end if;
  if not exists (
    select 1 from public.restaurant_memberships
    where restaurant_id = p_restaurant_id and user_id = p_actor_user_id
  ) then
    raise exception using errcode = '42501', message = 'GBP grant actor is not a restaurant member';
  end if;
  select rollout_mode into strict v_mode from public.gbp_write_rollout_config_v1
  where provider = 'google_business_profile';
  if v_mode = 'off'
    or (v_mode = 'canary' and not exists (select 1 from public.gbp_write_canary_restaurants_v1 where restaurant_id = p_restaurant_id and enabled))
    or (v_mode = 'allowlist' and not exists (select 1 from public.gbp_write_allowlist_v1 where restaurant_id = p_restaurant_id and enabled)) then
    raise exception using errcode = '42501', message = 'GBP write rollout denied';
  end if;
  if not exists (
    select 1 from public.gbp_write_readiness_evidence_v1 readiness
    join public.gbp_write_policy_config_v1 policy
      on policy.provider = readiness.provider
      and policy.policy_version = readiness.policy_version
      and policy.renderer_version = readiness.renderer_version
      and policy.backup_window_days = readiness.backup_window_days
      and policy.proven_content_ttl_days = readiness.live_content_ttl_days
    where readiness.provider = 'google_business_profile'
      and readiness.policy_version = p_policy_version
      and readiness.renderer_version = p_renderer_version
      and readiness.issued_at <= timezone('utc', now())
      and readiness.valid_until > timezone('utc', now())
      and readiness.live_content_ttl_days <= 28
      and readiness.live_content_ttl_days + readiness.backup_window_days < 30
  ) then
    raise exception using errcode = '42501', message = 'GBP write readiness is not proven';
  end if;
  if exists (select 1 from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id) then
    raise exception using errcode = '23505', message = 'GBP bundle id already exists';
  end if;
  if (select count(distinct (item).grant_id) from unnest(p_grants) item) <> v_count
    or (select array_agg((item).bundle_order order by (item).bundle_order) from unnest(p_grants) item)
      is distinct from (select array_agg(value) from generate_series(1, v_count) value) then
    raise exception using errcode = '22023', message = 'GBP grant bundle identity or order is invalid';
  end if;
  for v_item in select * from unnest(p_grants) order by bundle_order loop
    if v_item.grant_id is null
      or v_item.bundle_order is null
      or v_item.direction is distinct from 'export_to_google'
      or v_item.group_id is null
      or v_item.write_group is null
      or v_item.google_method is null
      or v_item.google_resource is null
      or v_item.update_masks_hash is null
      or v_item.request_hash is null
      or v_item.decision_hash is null
      or v_item.core_snapshot_hash is null
      or v_item.google_snapshot_hash is null
      or v_item.preview_fingerprint is null
      or v_item.manifest_hash is null
      or v_item.field_keys is null
      or v_item.update_masks is null
      or v_item.before_hashes is null
      or v_item.after_hashes is null
      or v_item.risk_acknowledgements is null
      or v_item.group_id !~ '^[A-Za-z0-9._:-]{1,100}$'
      or array_position(v_item.field_keys, null) is not null
      or array_position(v_item.update_masks, null) is not null
      or array_position(v_item.before_hashes, null) is not null
      or array_position(v_item.after_hashes, null) is not null
      or array_position(v_item.risk_acknowledgements, null) is not null
      or v_item.field_keys is distinct from public.array_sort_unique_text(v_item.field_keys)
      or cardinality(v_item.field_keys) < 1
      or cardinality(v_item.field_keys) <> cardinality(v_item.before_hashes)
      or cardinality(v_item.field_keys) <> cardinality(v_item.after_hashes)
      or not public.all_sha256_text(v_item.before_hashes || v_item.after_hashes)
      or v_item.update_masks is distinct from public.array_sort_unique_text(v_item.update_masks)
      or cardinality(v_item.update_masks) < 1
      or v_item.risk_acknowledgements is distinct from public.array_sort_unique_text(v_item.risk_acknowledgements)
      or not v_item.risk_acknowledgements @> array['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure']::text[]
      or v_item.google_method not in ('PATCH', 'POST', 'DELETE')
      or not (
        v_item.google_resource = 'locations/' || p_external_location_id
        or v_item.google_resource = 'accounts/' || p_external_account_id ||
          '/locations/' || p_external_location_id || '/foodMenus'
      )
      or not public.all_sha256_text(array[
        v_item.update_masks_hash, v_item.request_hash, v_item.decision_hash,
        v_item.core_snapshot_hash, v_item.google_snapshot_hash,
        v_item.preview_fingerprint, v_item.manifest_hash
      ]) then
      raise exception using errcode = '22023', message = 'GBP grant manifest is invalid';
    end if;
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
      v_item.grant_id, p_restaurant_id, p_external_profile_row_id, p_actor_user_id,
      p_external_account_id, p_external_profile_id, p_external_location_id,
      p_connection_generation, p_consent_epoch, v_item.direction, v_item.field_keys,
      v_item.group_id, v_item.write_group, v_item.google_method, v_item.google_resource,
      v_item.update_masks, v_item.update_masks_hash, v_item.before_hashes,
      v_item.after_hashes, v_item.request_hash, v_item.decision_hash,
      v_item.core_snapshot_hash, v_item.google_snapshot_hash,
      v_item.preview_fingerprint, v_item.risk_acknowledgements,
      p_policy_version, p_renderer_version, v_item.manifest_hash,
      p_bundle_id, v_item.bundle_order, v_count, p_bundle_hash, p_issued_at, p_expires_at
    );
  end loop;
  return query select * from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id order by bundle_order;
end;
$$;

create or replace function public.issue_and_enqueue_gbp_write_bundle_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_actor_user_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_bundle_id uuid,
  p_bundle_hash text, p_policy_version text, p_renderer_version text,
  p_issued_at timestamptz, p_expires_at timestamptz,
  p_grants public.gbp_write_grant_issue_v1[], p_job_id uuid
) returns public.gbp_write_bundle_enqueue_result_v1
language plpgsql security definer set search_path = public as $$
declare
  v_grants public.gbp_write_grants_v1[];
  v_grant_ids uuid[];
  v_manifest_hashes text[];
  v_groups jsonb;
  v_payload jsonb;
begin
  select array_agg(g order by g.bundle_order), array_agg(g.id order by g.bundle_order),
         array_agg(g.manifest_hash order by g.bundle_order)
  into v_grants, v_grant_ids, v_manifest_hashes
  from public.issue_gbp_write_bundle_v1(
    p_restaurant_id, p_external_profile_row_id, p_actor_user_id,
    p_external_account_id, p_external_profile_id, p_external_location_id,
    p_connection_generation, p_consent_epoch, p_bundle_id, p_bundle_hash,
    p_policy_version, p_renderer_version, p_issued_at, p_expires_at, p_grants
  ) g;
  select jsonb_agg(jsonb_build_object(
    'group_id', g.group_id, 'grant_id', g.id, 'bundle_order', g.bundle_order,
    'write_group', g.write_group, 'field_keys', g.field_keys,
    'google_method', g.google_method, 'google_resource', g.google_resource,
    'update_masks', g.update_masks, 'update_masks_hash', g.update_masks_hash,
    'before_hashes', g.before_hashes, 'after_hashes', g.after_hashes,
    'request_hash', g.request_hash, 'decision_hash', g.decision_hash,
    'core_snapshot_hash', g.core_snapshot_hash,
    'google_snapshot_hash', g.google_snapshot_hash,
    'preview_fingerprint', g.preview_fingerprint, 'manifest_hash', g.manifest_hash
  ) order by g.bundle_order) into v_groups from unnest(v_grants) g;
  v_payload := jsonb_build_object('bundle_id', p_bundle_id,
    'grant_ids', v_grant_ids, 'manifest_hashes', v_manifest_hashes,
    'groups', v_groups, 'confirmation_version', 'gbp-exact-consent-v1',
    'bundle_hash', p_bundle_hash, 'restaurant_id', p_restaurant_id,
    'external_account_id', p_external_account_id,
    'external_profile_id', p_external_profile_id,
    'external_profile_row_id', p_external_profile_row_id,
    'external_location_id', p_external_location_id,
    'connection_generation', p_connection_generation, 'consent_epoch', p_consent_epoch,
    'policy_version', p_policy_version, 'renderer_version', p_renderer_version,
    'expires_at', p_expires_at);
  insert into public.dual_sync_jobs (
    id, restaurant_id, provider, job_kind, status, payload, max_attempts,
    external_profile_id, external_account_id, external_location_id,
    connection_generation, consent_epoch, write_bundle_id
  ) values (
    p_job_id, p_restaurant_id, 'google_business_profile', 'publish_batch', 'queued',
    v_payload, 1, p_external_profile_id, p_external_account_id,
    p_external_location_id, p_connection_generation, p_consent_epoch, p_bundle_id
  );
  return row(v_grants, p_job_id, 'queued', v_payload)::public.gbp_write_bundle_enqueue_result_v1;
end;
$$;

create or replace function public.issue_and_claim_gbp_write_bundle_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_actor_user_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_bundle_id uuid,
  p_bundle_hash text, p_policy_version text, p_renderer_version text,
  p_issued_at timestamptz, p_expires_at timestamptz,
  p_grants public.gbp_write_grant_issue_v1[], p_execution_id uuid
) returns setof public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_grant_ids uuid[];
  v_manifest_hashes text[];
  v_request_hashes text[];
  v_decision_hashes text[];
  v_update_masks_hashes text[];
begin
  select array_agg(g.id order by g.bundle_order),
         array_agg(g.manifest_hash order by g.bundle_order),
         array_agg(g.request_hash order by g.bundle_order),
         array_agg(g.decision_hash order by g.bundle_order),
         array_agg(g.update_masks_hash order by g.bundle_order)
  into v_grant_ids, v_manifest_hashes, v_request_hashes,
       v_decision_hashes, v_update_masks_hashes
  from public.issue_gbp_write_bundle_v1(
    p_restaurant_id, p_external_profile_row_id, p_actor_user_id,
    p_external_account_id, p_external_profile_id, p_external_location_id,
    p_connection_generation, p_consent_epoch, p_bundle_id, p_bundle_hash,
    p_policy_version, p_renderer_version, p_issued_at, p_expires_at, p_grants
  ) g;
  return query select * from public.claim_gbp_write_bundle_v1(
    p_restaurant_id, p_external_profile_row_id, p_external_account_id,
    p_external_profile_id, p_external_location_id, p_connection_generation,
    p_consent_epoch, p_bundle_id, v_grant_ids, p_bundle_hash,
    v_manifest_hashes, v_request_hashes, v_decision_hashes,
    v_update_masks_hashes, p_policy_version, p_renderer_version, p_execution_id
  );
end;
$$;

create or replace function public.claim_gbp_write_bundle_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_external_account_id text,
  p_external_profile_id text, p_external_location_id text, p_connection_generation bigint,
  p_consent_epoch bigint, p_bundle_id uuid, p_grant_ids uuid[], p_bundle_hash text,
  p_manifest_hashes text[], p_request_hashes text[], p_decision_hashes text[],
  p_update_masks_hashes text[], p_policy_version text, p_renderer_version text, p_execution_id uuid
) returns setof public.gbp_write_grants_v1 language plpgsql security definer set search_path = public as $$
declare
  v_connection public.restaurant_external_profiles%rowtype;
  v_mode text;
  v_expected_count integer;
  v_locked_count integer;
begin
  select * into strict v_connection from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
  for update; -- connection lock first
  if v_connection.write_state <> 'eligible'
    or v_connection.external_account_id is distinct from p_external_account_id
    or v_connection.external_profile_id is distinct from p_external_profile_id
    or v_connection.external_location_id is distinct from p_external_location_id
    or v_connection.connection_generation <> p_connection_generation
    or v_connection.consent_epoch <> p_consent_epoch then
    raise exception using errcode = '42501', message = 'stale or ineligible GBP connection';
  end if;
  select rollout_mode into strict v_mode from public.gbp_write_rollout_config_v1 where provider = 'google_business_profile';
  if v_mode = 'off'
    or (v_mode = 'canary' and not exists (select 1 from public.gbp_write_canary_restaurants_v1 where restaurant_id = p_restaurant_id and enabled))
    or (v_mode = 'allowlist' and not exists (select 1 from public.gbp_write_allowlist_v1 where restaurant_id = p_restaurant_id and enabled)) then
    raise exception using errcode = '42501', message = 'GBP write rollout denied';
  end if;
  if not exists (select 1 from public.gbp_write_policy_config_v1 where provider = 'google_business_profile' and policy_version = p_policy_version and renderer_version = p_renderer_version and approved_at is not null) then
    raise exception using errcode = '42501', message = 'GBP write policy is not approved';
  end if;
  if not exists (
    select 1
    from public.gbp_write_readiness_evidence_v1 readiness
    join public.gbp_write_policy_config_v1 policy
      on policy.provider = readiness.provider
      and policy.policy_version = readiness.policy_version
      and policy.renderer_version = readiness.renderer_version
      and policy.backup_window_days = readiness.backup_window_days
      and policy.proven_content_ttl_days = readiness.live_content_ttl_days
    where readiness.provider = 'google_business_profile'
      and readiness.policy_version = p_policy_version
      and readiness.renderer_version = p_renderer_version
      and readiness.issued_at <= timezone('utc', now())
      and readiness.valid_until > timezone('utc', now())
      and readiness.live_content_ttl_days <= 28
      and readiness.live_content_ttl_days + readiness.backup_window_days < 30
  ) then
    raise exception using errcode = '42501', message = 'GBP write readiness is not proven';
  end if;
  select min(bundle_size), count(*) into v_expected_count, v_locked_count
  from (select g.bundle_size from public.gbp_write_grants_v1 g
        where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id
        order by g.bundle_order, g.id for update) locked;
  if v_locked_count <> cardinality(p_grant_ids) or v_expected_count <> v_locked_count
    or (select array_agg(g.manifest_hash order by g.bundle_order) from public.gbp_write_grants_v1 g where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id) is distinct from p_manifest_hashes
    or (select array_agg(g.request_hash order by g.bundle_order) from public.gbp_write_grants_v1 g where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id) is distinct from p_request_hashes
    or (select array_agg(g.decision_hash order by g.bundle_order) from public.gbp_write_grants_v1 g where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id) is distinct from p_decision_hashes
    or (select array_agg(g.update_masks_hash order by g.bundle_order) from public.gbp_write_grants_v1 g where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id) is distinct from p_update_masks_hashes
    or exists (select 1 from public.gbp_write_grants_v1 g where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id and (
      not (g.id = any(p_grant_ids)) or g.external_profile_row_id <> p_external_profile_row_id or
      g.external_account_id <> p_external_account_id or g.external_profile_id <> p_external_profile_id or
      g.external_location_id <> p_external_location_id or g.connection_generation <> p_connection_generation or
      g.consent_epoch <> p_consent_epoch or g.bundle_hash <> p_bundle_hash or
      g.policy_version <> p_policy_version or g.renderer_version <> p_renderer_version or g.bundle_size <> v_locked_count or
      g.status <> 'granted' or g.expires_at <= timezone('utc', now())
    )) then
    raise exception using errcode = '22023', message = 'incomplete or mismatched GBP grant bundle';
  end if;
  update public.gbp_write_grants_v1 set status = 'claimed', execution_id = p_execution_id, claimed_at = timezone('utc', now())
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and status = 'granted';
  insert into public.gbp_consent_events_v1 (restaurant_id, grant_id, bundle_id, execution_id, event_type, status, event_hash)
  select p_restaurant_id, id, p_bundle_id, p_execution_id, 'bundle_claimed', 'claimed', encode(digest(concat_ws(':', id::text, p_execution_id::text, 'claimed'), 'sha256'), 'hex')
  from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id;
  return query select * from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id order by bundle_order;
end;
$$;

create or replace function public.dispatch_gbp_write_bundle_v1(p_restaurant_id uuid, p_bundle_id uuid, p_execution_id uuid)
returns setof public.gbp_write_grants_v1 language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and (execution_id <> p_execution_id or status <> 'claimed')) then
    raise exception using errcode = '55000', message = 'GBP bundle is not wholly claimed';
  end if;
  update public.gbp_write_grants_v1 set status = 'dispatched', dispatched_at = timezone('utc', now())
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and execution_id = p_execution_id and status = 'claimed';
  if not found then raise exception using errcode = '55000', message = 'GBP bundle cannot be dispatched'; end if;
  insert into public.gbp_consent_events_v1 (restaurant_id, grant_id, bundle_id, execution_id, event_type, status, event_hash)
  select p_restaurant_id, id, p_bundle_id, p_execution_id, 'provider_dispatched', 'dispatched', encode(digest(concat_ws(':', id::text, p_execution_id::text, 'dispatched'), 'sha256'), 'hex')
  from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id;
  return query select * from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id order by bundle_order;
end;
$$;

create or replace function public.finalize_gbp_write_bundle_v1(p_restaurant_id uuid, p_bundle_id uuid, p_execution_id uuid, p_status text, p_reason_code text)
returns setof public.gbp_write_grants_v1 language plpgsql security definer set search_path = public as $$
declare v_required_status text;
begin
  if p_status in ('consumed', 'failed', 'outcome_unknown', 'cancelled_after_bundle_failure') then
    v_required_status := 'dispatched';
  elsif p_status = 'cancelled_before_dispatch' then
    v_required_status := 'claimed';
  else
    raise exception using errcode = '22023', message = 'invalid terminal status';
  end if;
  if exists (select 1 from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and (execution_id <> p_execution_id or status <> v_required_status)) then
    raise exception using errcode = '55000', message = 'GBP bundle has an invalid source status';
  end if;
  update public.gbp_write_grants_v1 set status = p_status, terminal_at = timezone('utc', now()), reason_code = p_reason_code
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and execution_id = p_execution_id and status = v_required_status;
  if not found then raise exception using errcode = '55000', message = 'GBP bundle cannot be finalized'; end if;
  insert into public.gbp_consent_events_v1 (restaurant_id, grant_id, bundle_id, execution_id, event_type, status, event_hash, reason_code)
  select p_restaurant_id, id, p_bundle_id, p_execution_id, 'bundle_terminal', p_status, encode(digest(concat_ws(':', id::text, p_execution_id::text, p_status), 'sha256'), 'hex'), p_reason_code
  from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id;
  return query select * from public.gbp_write_grants_v1 where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id order by bundle_order;
end;
$$;

create or replace function public.dispatch_gbp_write_grant_v1(
  p_restaurant_id uuid, p_bundle_id uuid, p_grant_id uuid,
  p_execution_id uuid, p_bundle_order integer
) returns public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_profile_row_id uuid;
  v_grant public.gbp_write_grants_v1%rowtype;
begin
  select external_profile_row_id into strict v_profile_row_id
  from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and id = p_grant_id;
  perform 1 from public.restaurant_external_profiles
  where restaurant_id = p_restaurant_id and id = v_profile_row_id for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
  order by bundle_order, id for update;
  select g.* into strict v_grant
  from public.gbp_write_grants_v1 g
  join public.restaurant_external_profiles p
    on p.restaurant_id = g.restaurant_id and p.id = g.external_profile_row_id
  where g.restaurant_id = p_restaurant_id and g.bundle_id = p_bundle_id
    and g.id = p_grant_id and g.bundle_order = p_bundle_order
    and g.execution_id = p_execution_id and g.status = 'claimed'
    and g.expires_at > timezone('utc', now()) and p.write_state = 'eligible'
    and p.external_account_id = g.external_account_id
    and p.external_profile_id = g.external_profile_id
    and p.external_location_id = g.external_location_id
    and p.connection_generation = g.connection_generation
    and p.consent_epoch = g.consent_epoch;
  if exists (
    select 1 from public.gbp_write_grants_v1
    where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
      and execution_id = p_execution_id and bundle_order < p_bundle_order
      and status <> 'consumed'
  ) then
    raise exception using errcode = '55000', message = 'prior GBP grant is not consumed';
  end if;
  update public.gbp_write_grants_v1
  set status = 'dispatched', dispatched_at = timezone('utc', now())
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
    and id = p_grant_id and bundle_order = p_bundle_order
    and execution_id = p_execution_id and status = 'claimed'
  returning * into strict v_grant;
  insert into public.gbp_consent_events_v1 (
    restaurant_id, grant_id, bundle_id, execution_id, event_type, status, event_hash
  ) values (
    p_restaurant_id, p_grant_id, p_bundle_id, p_execution_id,
    'provider_dispatched', 'dispatched',
    encode(digest(concat_ws(':', p_grant_id::text, p_execution_id::text, 'dispatched'), 'sha256'), 'hex')
  );
  return v_grant;
end;
$$;

create or replace function public.finalize_gbp_write_grant_v1(
  p_restaurant_id uuid, p_bundle_id uuid, p_grant_id uuid,
  p_execution_id uuid, p_bundle_order integer, p_status text, p_reason_code text
) returns public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_profile_row_id uuid;
  v_grant public.gbp_write_grants_v1%rowtype;
begin
  if p_status not in ('consumed', 'failed', 'outcome_unknown') then
    raise exception using errcode = '22023', message = 'invalid per-grant terminal status';
  end if;
  select external_profile_row_id into strict v_profile_row_id
  from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id and id = p_grant_id;
  perform 1 from public.restaurant_external_profiles
  where restaurant_id = p_restaurant_id and id = v_profile_row_id for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
  order by bundle_order, id for update;
  update public.gbp_write_grants_v1
  set status = p_status, terminal_at = timezone('utc', now()), reason_code = p_reason_code
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
    and id = p_grant_id and bundle_order = p_bundle_order
    and execution_id = p_execution_id and status = 'dispatched'
  returning * into strict v_grant;
  insert into public.gbp_consent_events_v1 (
    restaurant_id, grant_id, bundle_id, execution_id, event_type, status,
    event_hash, reason_code
  ) values (
    p_restaurant_id, p_grant_id, p_bundle_id, p_execution_id,
    'grant_terminal', p_status,
    encode(digest(concat_ws(':', p_grant_id::text, p_execution_id::text, p_status), 'sha256'), 'hex'),
    p_reason_code
  );
  if p_status in ('failed', 'outcome_unknown') then
    update public.gbp_write_grants_v1
    set status = 'cancelled_after_bundle_failure', terminal_at = timezone('utc', now()),
        reason_code = p_reason_code
    where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
      and execution_id = p_execution_id and bundle_order > p_bundle_order
      and status = 'claimed';
    insert into public.gbp_consent_events_v1 (
      restaurant_id, grant_id, bundle_id, execution_id, event_type, status,
      event_hash, reason_code
    )
    select p_restaurant_id, id, p_bundle_id, p_execution_id,
      'bundle_cancelled_after_failure', 'cancelled_after_bundle_failure',
      encode(digest(concat_ws(':', id::text, p_execution_id::text,
        'cancelled_after_bundle_failure'), 'sha256'), 'hex'), p_reason_code
    from public.gbp_write_grants_v1
    where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
      and execution_id = p_execution_id and bundle_order > p_bundle_order
      and status = 'cancelled_after_bundle_failure';
  end if;
  return v_grant;
end;
$$;

create or replace function public.recover_stale_gbp_dispatched_grants_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_cutoff timestamptz, p_limit integer default 100,
  p_now timestamptz default timezone('utc', now())
) returns setof public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_grant public.gbp_write_grants_v1%rowtype;
  v_cancelled public.gbp_write_grants_v1%rowtype;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500
    or p_cutoff is null or p_now is null
    or p_now < timezone('utc', now()) - interval '1 minute'
    or p_now > timezone('utc', now()) + interval '1 minute'
    or p_cutoff > p_now - interval '1 minute' then
    raise exception using errcode = '22023', message = 'invalid stale GBP dispatch recovery window';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.restaurant_external_profiles
  where restaurant_id = p_restaurant_id and id = p_external_profile_row_id
    and provider = 'google_business_profile'
    and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation
    and consent_epoch = p_consent_epoch
  for update;
  if not found then raise no_data_found; end if;
  for v_grant in
    select g.* from public.gbp_write_grants_v1 g
    where g.restaurant_id = p_restaurant_id
      and g.external_profile_row_id = p_external_profile_row_id
      and g.external_account_id = p_external_account_id
      and g.external_profile_id = p_external_profile_id
      and g.external_location_id = p_external_location_id
      and g.connection_generation = p_connection_generation
      and g.consent_epoch = p_consent_epoch
      and g.status = 'dispatched' and g.dispatched_at <= p_cutoff
    order by g.dispatched_at, g.bundle_id, g.bundle_order, g.id
    for update skip locked limit p_limit
  loop
    update public.gbp_write_grants_v1
    set status = 'outcome_unknown', terminal_at = p_now,
        reason_code = 'terminal_persistence_unknown'
    where restaurant_id = v_grant.restaurant_id and id = v_grant.id
      and status = 'dispatched'
    returning * into strict v_grant;
    insert into public.gbp_consent_events_v1 (
      restaurant_id, grant_id, bundle_id, execution_id, event_type, status,
      event_hash, reason_code
    ) values (
      v_grant.restaurant_id, v_grant.id, v_grant.bundle_id, v_grant.execution_id,
      'grant_terminal_recovered', 'outcome_unknown',
      encode(digest(concat_ws(':', v_grant.id::text, v_grant.execution_id::text,
        'outcome_unknown', 'terminal_persistence_unknown'), 'sha256'), 'hex'),
      'terminal_persistence_unknown'
    );
    for v_cancelled in
      update public.gbp_write_grants_v1
      set status = 'cancelled_after_bundle_failure', terminal_at = p_now,
          reason_code = 'terminal_persistence_unknown'
      where restaurant_id = v_grant.restaurant_id and bundle_id = v_grant.bundle_id
        and execution_id = v_grant.execution_id
        and bundle_order > v_grant.bundle_order and status = 'claimed'
      returning *
    loop
      insert into public.gbp_consent_events_v1 (
        restaurant_id, grant_id, bundle_id, execution_id, event_type, status,
        event_hash, reason_code
      ) values (
        v_cancelled.restaurant_id, v_cancelled.id, v_cancelled.bundle_id,
        v_cancelled.execution_id, 'bundle_cancelled_after_failure',
        'cancelled_after_bundle_failure',
        encode(digest(concat_ws(':', v_cancelled.id::text,
          v_cancelled.execution_id::text, 'cancelled_after_bundle_failure',
          'terminal_persistence_unknown'), 'sha256'), 'hex'),
        'terminal_persistence_unknown'
      );
    end loop;
    return next v_grant;
  end loop;
  return;
end;
$$;

create or replace function public.cancel_gbp_claimed_bundle_before_dispatch_v1(
  p_restaurant_id uuid, p_bundle_id uuid, p_execution_id uuid, p_reason_code text
) returns setof public.gbp_write_grants_v1
language plpgsql security definer set search_path = public as $$
declare
  v_profile_row_id uuid;
begin
  select external_profile_row_id into strict v_profile_row_id
  from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
  order by bundle_order limit 1;
  perform 1 from public.restaurant_external_profiles
  where restaurant_id = p_restaurant_id and id = v_profile_row_id for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
  order by bundle_order, id for update;
  if exists (
    select 1 from public.gbp_write_grants_v1
    where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
      and execution_id = p_execution_id
      and status in ('dispatched', 'consumed', 'failed', 'outcome_unknown',
                     'cancelled_after_bundle_failure')
  ) then
    raise exception using errcode = '55000', message = 'dispatched GBP grant prevents bundle cancellation';
  end if;
  if exists (
    select 1 from public.gbp_write_grants_v1
    where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
      and (execution_id is distinct from p_execution_id or status <> 'claimed')
  ) then
    raise exception using errcode = '55000', message = 'GBP bundle is not wholly cancellable';
  end if;
  update public.gbp_write_grants_v1
  set status = 'cancelled_before_dispatch', terminal_at = timezone('utc', now()),
      reason_code = p_reason_code
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id
    and execution_id = p_execution_id and status = 'claimed';
  insert into public.gbp_consent_events_v1 (
    restaurant_id, grant_id, bundle_id, execution_id, event_type, status,
    event_hash, reason_code
  )
  select p_restaurant_id, id, p_bundle_id, p_execution_id,
    'bundle_cancelled_before_dispatch', 'cancelled_before_dispatch',
    encode(digest(concat_ws(':', id::text, p_execution_id::text,
      'cancelled_before_dispatch'), 'sha256'), 'hex'), p_reason_code
  from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id;
  return query select * from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and bundle_id = p_bundle_id order by bundle_order;
end;
$$;

create or replace function public.expire_gbp_write_grants_v1(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with expired as (
    select id from public.gbp_write_grants_v1
    where status = 'granted' and expires_at <= timezone('utc', now())
    order by expires_at, id for update skip locked limit greatest(1, least(p_limit, 1000))
  )
  update public.gbp_write_grants_v1 set status = 'expired', terminal_at = timezone('utc', now()), reason_code = 'grant_expired'
  where id in (select id from expired);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.transition_gbp_connection_v1(p_restaurant_id uuid, p_external_profile_row_id uuid, p_expected_account_id text, p_expected_profile_id text, p_expected_location_id text, p_connection_generation bigint, p_consent_epoch bigint, p_next_state text, p_reason_code text, p_actor_user_id uuid)
returns public.restaurant_external_profiles language plpgsql security definer set search_path = public as $$
declare v_row public.restaurant_external_profiles%rowtype;
begin
  if p_actor_user_id is null then raise exception using errcode = '22023', message = 'actor is required for admin connection transition'; end if;
  if p_next_state not in ('blocked', 'revoking', 'disconnected', 'reauth_required') then raise exception using errcode = '22023', message = 'unsafe connection transition'; end if;
  select * into strict v_row from public.restaurant_external_profiles where id = p_external_profile_row_id and restaurant_id = p_restaurant_id and external_account_id is not distinct from p_expected_account_id and external_profile_id is not distinct from p_expected_profile_id and external_location_id is not distinct from p_expected_location_id and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch for update;
  if p_next_state in ('disconnected', 'reauth_required') then
    delete from public.gbp_notification_restaurant_links_v1 where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id;
  end if;
  update public.restaurant_external_profiles set write_state = p_next_state, consent_epoch = consent_epoch + 1, connection_generation = case when p_next_state in ('disconnected', 'reauth_required') then connection_generation + 1 else connection_generation end, push_enabled = false, write_state_reason_code = p_reason_code, write_state_actor_user_id = p_actor_user_id, write_state_changed_at = timezone('utc', now()) where id = p_external_profile_row_id returning * into v_row;
  update public.gbp_write_grants_v1 set status = case when status = 'dispatched' then 'outcome_unknown' when status = 'claimed' then 'cancelled_before_dispatch' else 'revoked' end, terminal_at = timezone('utc', now()), reason_code = p_reason_code where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id and status in ('granted', 'claimed', 'dispatched');
  update public.dual_sync_jobs set status = 'cancelled', finished_at = timezone('utc', now()), last_error_code = p_reason_code
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and status in ('queued', 'running', 'retrying')
    and (consent_epoch is null or consent_epoch < v_row.consent_epoch)
    and (
      (job_kind in ('publish_batch', 'auto_export') and
        (external_profile_id is null or external_profile_id is not distinct from v_row.external_profile_id))
      or
      (job_kind not in ('publish_batch', 'auto_export') and external_profile_id is not null and
        external_profile_id is not distinct from v_row.external_profile_id)
    );
  return v_row;
end;
$$;

create or replace function public.transition_gbp_connection_provider_failure_v1(
  p_restaurant_id uuid,
  p_external_profile_row_id uuid,
  p_expected_account_id text,
  p_expected_profile_id text,
  p_expected_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint,
  p_next_state text,
  p_reason_code text
)
returns public.restaurant_external_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row public.restaurant_external_profiles%rowtype;
begin
  if not (
    (p_next_state = 'reauth_required' and
      p_reason_code in ('provider_unauthorized_401', 'provider_invalid_grant'))
    or
    (p_next_state = 'blocked' and p_reason_code = 'provider_access_lost_403')
  ) then
    raise exception using errcode = '22023', message = 'invalid provider failure transition';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  select * into strict v_row
  from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id is not distinct from p_expected_account_id
    and external_profile_id is not distinct from p_expected_profile_id
    and external_location_id is not distinct from p_expected_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;

  if p_next_state = 'reauth_required' then
    delete from public.gbp_notification_restaurant_links_v1
    where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id;
  end if;
  update public.restaurant_external_profiles
  set write_state = p_next_state, consent_epoch = consent_epoch + 1,
      connection_generation = case when p_next_state = 'reauth_required'
        then connection_generation + 1 else connection_generation end,
      push_enabled = false, write_state_reason_code = p_reason_code,
      write_state_actor_user_id = null, write_state_changed_at = timezone('utc', now()),
      connection_status = case when p_next_state = 'reauth_required'
        then 'reauth_required' else connection_status end,
      last_error = p_reason_code, updated_at = timezone('utc', now())
  where id = p_external_profile_row_id
  returning * into v_row;
  update public.gbp_write_grants_v1
  set status = case when status = 'dispatched' then 'outcome_unknown'
                    when status = 'claimed' then 'cancelled_before_dispatch' else 'revoked' end,
      terminal_at = timezone('utc', now()), reason_code = p_reason_code
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
    and status in ('granted', 'claimed', 'dispatched');
  update public.dual_sync_jobs
  set status = 'cancelled', finished_at = timezone('utc', now()), last_error_code = p_reason_code
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and status in ('queued', 'running', 'retrying')
    and (consent_epoch is null or consent_epoch < v_row.consent_epoch)
    and (
      (job_kind in ('publish_batch', 'auto_export') and
        (external_profile_id is null or external_profile_id is not distinct from v_row.external_profile_id))
      or
      (job_kind not in ('publish_batch', 'auto_export') and external_profile_id is not null and
        external_profile_id is not distinct from v_row.external_profile_id)
    );
  return v_row;
end;
$$;

create or replace function public.set_gbp_write_access_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_enabled boolean, p_actor_user_id uuid
) returns public.restaurant_external_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row public.restaurant_external_profiles%rowtype;
  v_mode text;
  v_now timestamptz := timezone('utc', now());
begin
  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'actor is required for GBP write access';
  end if;
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  if not exists (
    select 1 from public.restaurant_memberships
    where restaurant_id = p_restaurant_id and user_id = p_actor_user_id
  ) then raise exception using errcode = '42501', message = 'GBP write access actor is not a restaurant member'; end if;
  select * into strict v_row from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if p_enabled then
    if v_row.connection_status <> 'linked' or v_row.write_state not in ('blocked','eligible') then
      raise exception using errcode = '42501', message = 'GBP connection cannot enable writes';
    end if;
    select rollout_mode into strict v_mode from public.gbp_write_rollout_config_v1
    where provider = 'google_business_profile';
    if v_mode = 'off'
      or (v_mode = 'canary' and not exists (
        select 1 from public.gbp_write_canary_restaurants_v1
        where restaurant_id = p_restaurant_id and enabled
      ))
      or (v_mode = 'allowlist' and not exists (
        select 1 from public.gbp_write_allowlist_v1
        where restaurant_id = p_restaurant_id and enabled
      )) then
      raise exception using errcode = '42501', message = 'GBP write rollout denied';
    end if;
    if not exists (
      select 1 from public.gbp_write_readiness_evidence_v1 readiness
      join public.gbp_write_policy_config_v1 policy
        on policy.provider = readiness.provider
        and policy.policy_version = readiness.policy_version
        and policy.renderer_version = readiness.renderer_version
        and policy.backup_window_days = readiness.backup_window_days
        and policy.proven_content_ttl_days = readiness.live_content_ttl_days
      where readiness.provider = 'google_business_profile'
        and readiness.issued_at <= v_now and readiness.valid_until > v_now
        and readiness.live_content_ttl_days <= 28
        and readiness.live_content_ttl_days + readiness.backup_window_days < 30
    ) then raise exception using errcode = '42501', message = 'GBP write readiness is not proven'; end if;
    if v_row.write_state = 'eligible' then return v_row; end if;
    update public.restaurant_external_profiles set write_state = 'eligible', push_enabled = true,
      write_state_reason_code = 'owner_enabled', write_state_actor_user_id = p_actor_user_id,
      write_state_changed_at = v_now, updated_at = v_now
    where id = p_external_profile_row_id returning * into v_row;
    return v_row;
  end if;
  if v_row.write_state = 'blocked' then return v_row; end if;
  if v_row.write_state <> 'eligible' then
    raise exception using errcode = '42501', message = 'GBP connection cannot disable writes';
  end if;
  update public.restaurant_external_profiles set write_state = 'blocked', push_enabled = false,
    consent_epoch = consent_epoch + 1, write_state_reason_code = 'owner_disabled',
    write_state_actor_user_id = p_actor_user_id, write_state_changed_at = v_now, updated_at = v_now
  where id = p_external_profile_row_id returning * into v_row;
  update public.gbp_write_grants_v1
  set status = case when status = 'dispatched' then 'outcome_unknown'
                    when status = 'claimed' then 'cancelled_before_dispatch' else 'revoked' end,
      terminal_at = v_now, reason_code = 'owner_disabled'
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
    and status in ('granted','claimed','dispatched');
  update public.dual_sync_jobs set status = 'cancelled', finished_at = v_now,
    last_error_code = 'owner_disabled'
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and job_kind in ('publish_batch','auto_export')
    and status in ('queued','running','retrying')
    and (external_profile_id is null or external_profile_id = p_external_profile_id)
    and (consent_epoch is null or consent_epoch <= v_row.consent_epoch);
  return v_row;
end;
$$;

create or replace function public.rebind_gbp_connection_v1(p_restaurant_id uuid, p_external_profile_row_id uuid, p_expected_account_id text, p_expected_profile_id text, p_expected_location_id text, p_connection_generation bigint, p_consent_epoch bigint, p_new_account_id text, p_new_profile_id text, p_new_location_id text, p_reason_code text, p_actor_user_id uuid)
returns public.restaurant_external_profiles language plpgsql security definer set search_path = public as $$
declare v_row public.restaurant_external_profiles%rowtype;
begin
  select * into strict v_row from public.restaurant_external_profiles where id = p_external_profile_row_id and restaurant_id = p_restaurant_id and external_account_id is not distinct from p_expected_account_id and external_profile_id is not distinct from p_expected_profile_id and external_location_id is not distinct from p_expected_location_id and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch for update;
  update public.restaurant_external_profiles
  set write_state = 'revoking', push_enabled = false,
      write_state_reason_code = p_reason_code, write_state_actor_user_id = p_actor_user_id,
      write_state_changed_at = timezone('utc', now())
  where id = p_external_profile_row_id;
  perform public.purge_gbp_profile_content_v1(
    p_restaurant_id, p_external_profile_row_id, p_expected_account_id,
    p_expected_profile_id, p_expected_location_id,
    p_connection_generation, p_consent_epoch
  );
  delete from public.gbp_notification_restaurant_links_v1 where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id;
  update public.restaurant_external_profiles set external_account_id = p_new_account_id, external_profile_id = p_new_profile_id, external_location_id = p_new_location_id, write_state = 'blocked', consent_epoch = consent_epoch + 1, connection_generation = connection_generation + 1, push_enabled = false, write_state_reason_code = p_reason_code, write_state_actor_user_id = p_actor_user_id, write_state_changed_at = timezone('utc', now()) where id = p_external_profile_row_id returning * into v_row;
  update public.gbp_write_grants_v1 set status = case when status = 'dispatched' then 'outcome_unknown' when status = 'claimed' then 'cancelled_before_dispatch' else 'revoked' end, terminal_at = timezone('utc', now()), reason_code = p_reason_code where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id and status in ('granted', 'claimed', 'dispatched');
  update public.dual_sync_jobs set status = 'cancelled', finished_at = timezone('utc', now()), last_error_code = p_reason_code
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and status in ('queued', 'running', 'retrying')
    and (consent_epoch is null or consent_epoch <= p_consent_epoch)
    and (
      (job_kind in ('publish_batch', 'auto_export') and
        (external_profile_id is null or external_profile_id is not distinct from p_expected_profile_id))
      or
      (job_kind not in ('publish_batch', 'auto_export') and external_profile_id is not null and
        external_profile_id is not distinct from p_expected_profile_id)
    );
  return v_row;
end;
$$;

create or replace function public.record_gbp_provider_observation_v1(p_restaurant_id uuid, p_external_profile_row_id uuid, p_external_account_id text, p_external_profile_id text, p_external_location_id text, p_connection_generation bigint, p_consent_epoch bigint, p_source_table text, p_source_row_id uuid, p_field_key text, p_value_hash text, p_observed_at timestamptz, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform 1 from public.restaurant_external_profiles where id = p_external_profile_row_id and restaurant_id = p_restaurant_id and external_account_id = p_external_account_id and external_profile_id = p_external_profile_id and external_location_id = p_external_location_id and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch;
  if not found then raise exception using errcode = '42501', message = 'stale GBP observation fence'; end if;
  insert into public.gbp_field_provenance_v1 (restaurant_id, source_table, source_row_id, field_key, source, value_hash, external_profile_row_id, external_account_id, external_profile_id, external_location_id, connection_generation, consent_epoch, observed_at, expires_at, expiry_basis)
  values (p_restaurant_id, p_source_table, p_source_row_id, p_field_key, 'google', p_value_hash, p_external_profile_row_id, p_external_account_id, p_external_profile_id, p_external_location_id, p_connection_generation, p_consent_epoch, p_observed_at, p_expires_at, 'fresh_provider_fetch')
  on conflict (restaurant_id, source_table, source_row_id, field_key) do update set source = 'google', value_hash = excluded.value_hash, external_profile_row_id = excluded.external_profile_row_id, external_account_id = excluded.external_account_id, external_profile_id = excluded.external_profile_id, external_location_id = excluded.external_location_id, connection_generation = excluded.connection_generation, consent_epoch = excluded.consent_epoch, observed_at = excluded.observed_at, expires_at = excluded.expires_at, expiry_basis = excluded.expiry_basis, updated_at = timezone('utc', now())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.claim_gbp_core_changes_v1(p_worker_id text, p_limit integer default 50)
returns setof public.gbp_core_change_outbox_v1 language plpgsql security definer set search_path = public as $$
begin
  raise exception using errcode = '0A000', message = 'use leased Core outbox v2 claim';
end;
$$;

create or replace function public.complete_gbp_core_change_v1(p_restaurant_id uuid, p_outbox_id uuid, p_worker_id text, p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  raise exception using errcode = '0A000', message = 'use leased Core outbox v2 completion';
end;
$$;

create or replace function public.claim_gbp_core_changes_v2(
  p_worker_id text, p_limit integer default 50, p_lease_seconds integer default 60
) returns setof public.gbp_core_change_outbox_v1
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,100}$'
    or p_limit is null or p_limit < 1 or p_limit > 100
    or p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'invalid Core outbox claim envelope';
  end if;

  with stale as materialized (
    select id from public.gbp_core_change_outbox_v1
    where status = 'claimed' and lease_expires_at <= v_now
    order by lease_expires_at, id
    for update skip locked limit 100
  )
  update public.gbp_core_change_outbox_v1 o
  set status = case when o.attempt_count >= o.max_attempts then 'dead_letter' else 'pending' end,
      available_at = v_now,
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null,
      lease_token = null,
      last_error_code = case when o.attempt_count >= o.max_attempts
        then 'lease_expired_exhausted' else 'lease_expired' end,
      dead_lettered_at = case when o.attempt_count >= o.max_attempts then v_now else null end
  from stale where o.id = stale.id;

  with exhausted as materialized (
    select id from public.gbp_core_change_outbox_v1
    where status = 'pending' and attempt_count >= max_attempts
    order by available_at, created_at, id
    for update skip locked limit 100
  )
  update public.gbp_core_change_outbox_v1 o
  set status = 'dead_letter', dead_lettered_at = v_now,
      last_error_code = coalesce(last_error_code, 'lease_expired_exhausted')
  from exhausted where o.id = exhausted.id;

  return query
  with candidates as materialized (
    select id, available_at, created_at
    from public.gbp_core_change_outbox_v1
    where status = 'pending' and available_at <= v_now and attempt_count < max_attempts
    order by available_at, created_at, id
    for update skip locked limit p_limit
  ), claimed as (
    update public.gbp_core_change_outbox_v1 o
    set status = 'claimed', attempt_count = o.attempt_count + 1,
        claimed_by = p_worker_id, claimed_at = v_now,
        lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
        lease_token = gen_random_uuid(), completed_at = null,
        dead_lettered_at = null
    from candidates where o.id = candidates.id
    returning o.*
  )
  select claimed.* from claimed
  join candidates using (id)
  order by candidates.available_at, candidates.created_at, candidates.id;
end;
$$;

create or replace function public.complete_gbp_core_change_v2(
  p_restaurant_id uuid, p_outbox_id uuid, p_worker_id text,
  p_lease_token uuid, p_outcome text, p_error_code text default null
) returns public.gbp_core_change_outbox_v1
language plpgsql security definer set search_path = public as $$
declare
  v_row public.gbp_core_change_outbox_v1%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_backoff_seconds integer;
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,100}$'
    or p_lease_token is null
    or p_outcome is null or p_outcome not in ('success', 'retryable_failure', 'terminal_failure')
    or (p_outcome = 'success' and p_error_code is not null)
    or (p_outcome <> 'success' and (p_error_code is null or p_error_code not in (
      'provider_error', 'transient_error', 'rate_limited', 'timeout',
      'stale_fence', 'invalid_manifest', 'policy_blocked',
      'reconciliation_required', 'unknown'
    ))) then
    raise exception using errcode = '22023', message = 'invalid Core outbox completion envelope';
  end if;

  select * into v_row from public.gbp_core_change_outbox_v1
  where id = p_outbox_id and restaurant_id = p_restaurant_id
    and status = 'claimed' and claimed_by = p_worker_id
    and lease_token = p_lease_token and lease_expires_at > v_now
  for update;
  if not found then raise no_data_found; end if;

  if p_outcome = 'success' then
    update public.gbp_core_change_outbox_v1
    set status = 'completed', completed_at = v_now,
        claimed_by = null, claimed_at = null, lease_expires_at = null,
        lease_token = null, last_error_code = null
    where id = v_row.id returning * into v_row;
  elsif p_outcome = 'terminal_failure' or v_row.attempt_count >= v_row.max_attempts then
    update public.gbp_core_change_outbox_v1
    set status = 'dead_letter', dead_lettered_at = v_now,
        claimed_by = null, claimed_at = null, lease_expires_at = null,
        lease_token = null, last_error_code = p_error_code
    where id = v_row.id returning * into v_row;
  else
    v_backoff_seconds := least(900, (5 * power(2, least(v_row.attempt_count - 1, 7)))::integer);
    update public.gbp_core_change_outbox_v1
    set status = 'pending', available_at = v_now + make_interval(secs => v_backoff_seconds),
        claimed_by = null, claimed_at = null, lease_expires_at = null,
        lease_token = null, last_error_code = p_error_code
    where id = v_row.id returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.get_gbp_core_outbox_census_v1(p_restaurant_id uuid)
returns public.gbp_core_outbox_census_v1
language sql stable security definer set search_path = public as $$
  select row(
    count(*) filter (where status = 'pending' and available_at <= timezone('utc', now())),
    count(*) filter (where status = 'pending' and available_at > timezone('utc', now())),
    count(*) filter (where status = 'claimed'),
    count(*) filter (where status = 'claimed' and lease_expires_at <= timezone('utc', now())),
    count(*) filter (where status = 'dead_letter'),
    count(*) filter (where status = 'completed'),
    greatest(0, floor(extract(epoch from timezone('utc', now()) - min(created_at)
      filter (where status in ('pending', 'claimed')))))::bigint
  )::public.gbp_core_outbox_census_v1
  from public.gbp_core_change_outbox_v1 where restaurant_id = p_restaurant_id;
$$;

create or replace function public.repair_gbp_core_change_v1(
  p_restaurant_id uuid, p_outbox_id uuid, p_idempotency_hash text,
  p_operator_user_id uuid, p_operator_repair boolean,
  p_insert_missing boolean default false, p_source_table text default null,
  p_source_row_id uuid default null, p_operation text default null,
  p_field_keys text[] default null, p_before_hash text default null,
  p_after_hash text default null
) returns public.gbp_core_change_outbox_v1
language plpgsql security definer set search_path = public as $$
declare
  v_row public.gbp_core_change_outbox_v1%rowtype;
begin
  if p_operator_repair is distinct from true
    or p_idempotency_hash is null or p_idempotency_hash !~ '^[a-f0-9]{64}$'
    or not exists (
      select 1 from public.restaurant_memberships
      where restaurant_id = p_restaurant_id and user_id = p_operator_user_id
        and role in ('owner', 'admin')
    ) then
    raise exception using errcode = '42501', message = 'Core outbox repair is not authorized';
  end if;

  select * into v_row from public.gbp_core_change_outbox_v1
  where restaurant_id = p_restaurant_id and id = p_outbox_id
    and idempotency_hash = p_idempotency_hash
  for update;
  if found then
    if v_row.status not in ('completed', 'dead_letter') then
      raise exception using errcode = '55000', message = 'Core outbox entry is not repairable';
    end if;
    update public.gbp_core_change_outbox_v1
    set status = 'pending', attempt_count = 0, available_at = timezone('utc', now()),
        claimed_by = null, claimed_at = null, lease_expires_at = null,
        lease_token = null, completed_at = null, dead_lettered_at = null,
        last_error_code = 'operator_repair'
    where id = v_row.id returning * into v_row;
    return v_row;
  end if;

  if p_insert_missing is distinct from true
    or p_source_table not in (
      'restaurant_business_details', 'restaurant_addresses',
      'restaurant_phone_numbers', 'restaurant_links', 'restaurant_categories',
      'restaurant_service_areas', 'restaurant_hours', 'restaurant_attributes',
      'restaurant_service_items', 'restaurants', 'restaurant_operating_hours',
      'restaurant_service_periods'
    )
    or p_source_row_id is null or p_operation not in ('INSERT', 'UPDATE', 'DELETE')
    or p_field_keys is null or cardinality(p_field_keys) < 1
    or array_position(p_field_keys, null) is not null
    or p_field_keys is distinct from public.array_sort_unique_text(p_field_keys)
    or (p_before_hash is not null and p_before_hash !~ '^[a-f0-9]{64}$')
    or (p_after_hash is not null and p_after_hash !~ '^[a-f0-9]{64}$')
    or not ((p_operation = 'INSERT' and p_before_hash is null and p_after_hash is not null)
      or (p_operation = 'UPDATE' and p_before_hash is not null and p_after_hash is not null)
      or (p_operation = 'DELETE' and p_before_hash is not null and p_after_hash is null)) then
    raise exception using errcode = '22023', message = 'invalid missing Core outbox repair envelope';
  end if;

  insert into public.gbp_core_change_outbox_v1 (
    id, restaurant_id, source_table, source_row_id, operation, field_keys,
    before_hash, after_hash, idempotency_hash, last_error_code
  ) values (
    p_outbox_id, p_restaurant_id, p_source_table, p_source_row_id, p_operation,
    p_field_keys, p_before_hash, p_after_hash, p_idempotency_hash, 'operator_repair'
  ) returning * into v_row;
  return v_row;
end;
$$;

-- OAuth state/nonce evidence is hash-only. Legacy raw states are irreversibly
-- rewritten and invalidated so the pre-fence access path fails closed.
alter table public.restaurant_external_profile_oauth_states
  add column if not exists state_hash text,
  add column if not exists oidc_nonce_hash text,
  add column if not exists external_profile_row_id uuid,
  add column if not exists expected_external_account_id text,
  add column if not exists expected_external_profile_id text,
  add column if not exists expected_external_location_id text,
  add column if not exists connection_generation bigint,
  add column if not exists consent_epoch bigint,
  add column if not exists invalidated_at timestamptz,
  add column if not exists invalidation_reason text;

alter table public.restaurant_external_profile_credentials
  add column if not exists identity_verified_at timestamptz;

update public.restaurant_external_profile_oauth_states
set state_hash = encode(digest('legacy-state:' || id::text || ':' || state_token, 'sha256'), 'hex'),
    oidc_nonce_hash = encode(digest('legacy-nonce:' || id::text || ':' || state_token, 'sha256'), 'hex'),
    state_token = encode(digest('legacy-state:' || id::text || ':' || state_token, 'sha256'), 'hex'),
    connection_generation = 1,
    consent_epoch = 1,
    invalidated_at = coalesce(invalidated_at, timezone('utc', now())),
    invalidation_reason = 'legacy_unfenced',
    expires_at = least(expires_at, created_at + interval '15 minutes')
where provider = 'google_business_profile' and state_hash is null;

alter table public.restaurant_external_profile_oauth_states
  alter column state_hash set not null,
  alter column oidc_nonce_hash set not null,
  alter column connection_generation set not null,
  alter column consent_epoch set not null,
  add constraint restaurant_external_profile_oauth_states_state_hash_v1_check
    check (state_hash ~ '^[a-f0-9]{64}$' and state_token = state_hash),
  add constraint restaurant_external_profile_oauth_states_nonce_hash_v1_check
    check (oidc_nonce_hash ~ '^[a-f0-9]{64}$'),
  add constraint restaurant_external_profile_oauth_states_epoch_v1_check
    check (connection_generation > 0 and consent_epoch > 0),
  add constraint restaurant_external_profile_oauth_states_expiry_v1_check
    check (expires_at <= created_at + interval '15 minutes'),
  add constraint restaurant_external_profile_oauth_states_terminal_v1_check
    check (consumed_at is null or invalidated_at is null),
  add constraint restaurant_external_profile_oauth_states_binding_v1_check
    check (
      (external_profile_row_id is null and expected_external_account_id is null and
       expected_external_profile_id is null and expected_external_location_id is null and
       connection_generation = 1 and consent_epoch = 1)
      or external_profile_row_id is not null
    ),
  add constraint restaurant_external_profile_oauth_states_profile_tenant_v1_fkey
    foreign key (restaurant_id, external_profile_row_id)
    references public.restaurant_external_profiles (restaurant_id, id) on delete cascade;

create unique index restaurant_external_profile_oauth_states_state_hash_v1_uidx
  on public.restaurant_external_profile_oauth_states (state_hash);
create index restaurant_external_profile_oauth_states_fence_v1_idx
  on public.restaurant_external_profile_oauth_states
  (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, expires_at desc);
create unique index restaurant_external_profile_oauth_states_one_active_v1_uidx
  on public.restaurant_external_profile_oauth_states (restaurant_id, provider)
  where consumed_at is null and invalidated_at is null;

create or replace function public.create_gbp_oauth_attempt_v1(
  p_restaurant_id uuid,
  p_requested_by_user_id uuid,
  p_state_hash text,
  p_nonce_hash text,
  p_return_path text,
  p_expires_at timestamptz,
  p_external_profile_row_id uuid,
  p_expected_external_account_id text,
  p_expected_external_profile_id text,
  p_expected_external_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint
)
returns public.restaurant_external_profile_oauth_states
language plpgsql security definer set search_path = public as $$
declare
  v_connection public.restaurant_external_profiles%rowtype;
  v_attempt public.restaurant_external_profile_oauth_states%rowtype;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_nonce_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'OAuth state and nonce hashes must be SHA-256';
  end if;
  if p_expires_at <= timezone('utc', now()) or p_expires_at > timezone('utc', now()) + interval '15 minutes' then
    raise exception using errcode = '22023', message = 'OAuth attempt expiry must be within 15 minutes';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update; -- restaurant lock first
  if not found then raise no_data_found; end if;

  if p_external_profile_row_id is null then
    if p_expected_external_account_id is not null or p_expected_external_profile_id is not null or
       p_expected_external_location_id is not null or p_connection_generation <> 1 or p_consent_epoch <> 1 then
      raise exception using errcode = '22023', message = 'Invalid initial OAuth fence';
    end if;
    if exists (
      select 1 from public.restaurant_external_profiles
      where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    ) then
      raise exception using errcode = '42501', message = 'Initial OAuth link no longer current';
    end if;
  else
    select * into strict v_connection
    from public.restaurant_external_profiles
    where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
      and provider = 'google_business_profile'
      and external_account_id is not distinct from p_expected_external_account_id
      and external_profile_id is not distinct from p_expected_external_profile_id
      and external_location_id is not distinct from p_expected_external_location_id
      and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    for update; -- connection lock second
  end if;

  update public.restaurant_external_profile_oauth_states
  set invalidated_at = timezone('utc', now()), invalidation_reason = 'superseded'
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and consumed_at is null and invalidated_at is null;

  insert into public.restaurant_external_profile_oauth_states (
    restaurant_id, provider, requested_by_user_id, state_token, state_hash,
    oidc_nonce_hash, return_path, expires_at, external_profile_row_id,
    expected_external_account_id, expected_external_profile_id,
    expected_external_location_id, connection_generation, consent_epoch
  ) values (
    p_restaurant_id, 'google_business_profile', p_requested_by_user_id,
    p_state_hash, p_state_hash, p_nonce_hash, p_return_path, p_expires_at,
    p_external_profile_row_id, p_expected_external_account_id,
    p_expected_external_profile_id, p_expected_external_location_id,
    p_connection_generation, p_consent_epoch
  ) returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.consume_gbp_oauth_attempt_v1(
  p_restaurant_id uuid,
  p_state_hash text,
  p_nonce_hash text,
  p_external_profile_row_id uuid,
  p_expected_external_account_id text,
  p_expected_external_profile_id text,
  p_expected_external_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint
)
returns public.restaurant_external_profile_oauth_states
language plpgsql security definer set search_path = public as $$
declare
  v_connection public.restaurant_external_profiles%rowtype;
  v_attempt public.restaurant_external_profile_oauth_states%rowtype;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_nonce_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'OAuth state and nonce hashes must be SHA-256';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update; -- restaurant lock first
  if not found then raise no_data_found; end if;

  if p_external_profile_row_id is null then
    if p_expected_external_account_id is not null or p_expected_external_profile_id is not null or
       p_expected_external_location_id is not null or p_connection_generation <> 1 or p_consent_epoch <> 1 or
       exists (select 1 from public.restaurant_external_profiles where restaurant_id = p_restaurant_id and provider = 'google_business_profile') then
      raise exception using errcode = '42501', message = 'Initial OAuth callback is stale';
    end if;
  else
    select * into strict v_connection
    from public.restaurant_external_profiles
    where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
      and provider = 'google_business_profile'
      and external_account_id is not distinct from p_expected_external_account_id
      and external_profile_id is not distinct from p_expected_external_profile_id
      and external_location_id is not distinct from p_expected_external_location_id
      and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    for update; -- connection lock second
  end if;

  select * into strict v_attempt
  from public.restaurant_external_profile_oauth_states
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and state_hash = p_state_hash and oidc_nonce_hash = p_nonce_hash
    and external_profile_row_id is not distinct from p_external_profile_row_id
    and expected_external_account_id is not distinct from p_expected_external_account_id
    and expected_external_profile_id is not distinct from p_expected_external_profile_id
    and expected_external_location_id is not distinct from p_expected_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    and consumed_at is null and invalidated_at is null and expires_at > timezone('utc', now())
  for update; -- oauth attempt lock last

  update public.restaurant_external_profile_oauth_states
  set consumed_at = timezone('utc', now())
  where id = v_attempt.id
  returning * into v_attempt;
  return v_attempt;
end;
$$;

create or replace function public.complete_gbp_oauth_identity_v1(
  p_restaurant_id uuid,
  p_state_hash text,
  p_nonce_hash text,
  p_requested_by_user_id uuid,
  p_target_external_profile_row_id uuid,
  p_provider_user_id text,
  p_connected_email text,
  p_connected_name text,
  p_refresh_token_encrypted text,
  p_granted_scopes text[],
  p_token_type text,
  p_refreshed_at timestamptz,
  p_identity_verified_at timestamptz
)
returns public.restaurant_external_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_attempt public.restaurant_external_profile_oauth_states%rowtype;
  v_connection public.restaurant_external_profiles%rowtype;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_nonce_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'OAuth state and nonce hashes must be SHA-256';
  end if;
  if p_refresh_token_encrypted !~ '^gbp\.1\.[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$' then
    raise exception using errcode = '22023', message = 'Credential must use the GBP encrypted envelope';
  end if;
  if nullif(btrim(p_provider_user_id), '') is null or
     (p_connected_email is not null and
       (nullif(btrim(p_connected_email), '') is null or position('@' in p_connected_email) <= 1)) or
     p_granted_scopes is null or exists (select 1 from unnest(p_granted_scopes) scope where nullif(btrim(scope), '') is null) or
     p_refreshed_at > timezone('utc', now()) + interval '1 minute' or
     p_refreshed_at < timezone('utc', now()) - interval '15 minutes' or
     p_identity_verified_at > p_refreshed_at or
     p_identity_verified_at < p_refreshed_at - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'Verified OAuth identity is invalid';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update; -- completion restaurant lock first
  if not found then raise no_data_found; end if;

  select * into strict v_attempt
  from public.restaurant_external_profile_oauth_states
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and state_hash = p_state_hash and oidc_nonce_hash = p_nonce_hash
    and requested_by_user_id = p_requested_by_user_id
    and consumed_at is null and invalidated_at is null and expires_at > timezone('utc', now());

  if v_attempt.external_profile_row_id is null then
    if v_attempt.connection_generation <> 1 or v_attempt.consent_epoch <> 1 or
       v_attempt.expected_external_account_id is not null or
       v_attempt.expected_external_profile_id is not null or
       v_attempt.expected_external_location_id is not null or
       exists (select 1 from public.restaurant_external_profiles where restaurant_id = p_restaurant_id and provider = 'google_business_profile') then
      raise exception using errcode = '42501', message = 'Initial OAuth completion is stale';
    end if;
    insert into public.restaurant_external_profiles (
      id, restaurant_id, provider, connection_status, push_enabled, write_state,
      connection_generation, consent_epoch, write_state_reason_code,
      write_state_actor_user_id, write_state_changed_at
    ) values (
      p_target_external_profile_row_id, p_restaurant_id, 'google_business_profile',
      'authorized', false, 'blocked', 1, 1, 'oauth_identity_completed',
      p_requested_by_user_id, timezone('utc', now())
    ) returning * into v_connection;
  else
    if p_target_external_profile_row_id <> v_attempt.external_profile_row_id then
      raise exception using errcode = '22023', message = 'OAuth completion profile binding mismatch';
    end if;
    select * into strict v_connection
    from public.restaurant_external_profiles
    where id = v_attempt.external_profile_row_id and restaurant_id = p_restaurant_id
      and provider = 'google_business_profile'
      and external_account_id is not distinct from v_attempt.expected_external_account_id
      and external_profile_id is not distinct from v_attempt.expected_external_profile_id
      and external_location_id is not distinct from v_attempt.expected_external_location_id
      and connection_generation = v_attempt.connection_generation
      and consent_epoch = v_attempt.consent_epoch
    for update; -- completion profile lock second

    update public.restaurant_external_profiles
    set connection_status = case when external_location_id is null then 'authorized' else 'linked' end,
        last_error = null, write_state = 'blocked', push_enabled = false,
        write_state_reason_code = 'oauth_identity_completed',
        write_state_actor_user_id = p_requested_by_user_id,
        write_state_changed_at = timezone('utc', now()), updated_at = timezone('utc', now())
    where id = v_connection.id
    returning * into v_connection;
  end if;

  select * into strict v_attempt
  from public.restaurant_external_profile_oauth_states
  where id = v_attempt.id and restaurant_id = p_restaurant_id
    and state_hash = p_state_hash and oidc_nonce_hash = p_nonce_hash
    and requested_by_user_id = p_requested_by_user_id
    and consumed_at is null and invalidated_at is null and expires_at > timezone('utc', now())
  for update; -- completion attempt lock last

  insert into public.restaurant_external_profile_credentials (
    external_profile_id, provider_user_id, connected_google_email,
    connected_google_name, refresh_token_encrypted, granted_scopes, token_type,
    last_refreshed_at, identity_verified_at, last_error
  ) values (
    v_connection.id, p_provider_user_id, p_connected_email, p_connected_name,
    p_refresh_token_encrypted, public.array_sort_unique_text(p_granted_scopes),
    p_token_type, p_refreshed_at, p_identity_verified_at, null
  ) on conflict (external_profile_id) do update
  set provider_user_id = excluded.provider_user_id,
      connected_google_email = excluded.connected_google_email,
      connected_google_name = excluded.connected_google_name,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      granted_scopes = excluded.granted_scopes,
      token_type = excluded.token_type,
      last_refreshed_at = excluded.last_refreshed_at,
      identity_verified_at = excluded.identity_verified_at,
      last_error = null,
      updated_at = timezone('utc', now());

  update public.restaurant_external_profile_oauth_states
  set consumed_at = timezone('utc', now())
  where id = v_attempt.id;
  return v_connection;
end;
$$;

create or replace function public.refresh_gbp_credential_v1(
  p_restaurant_id uuid,
  p_external_profile_row_id uuid,
  p_expected_account_id text,
  p_expected_profile_id text,
  p_expected_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint,
  p_expected_refresh_token_encrypted text,
  p_refresh_token_encrypted text,
  p_granted_scopes text[],
  p_token_type text,
  p_refreshed_at timestamptz
)
returns public.restaurant_external_profile_credentials
language plpgsql security definer set search_path = public as $$
declare
  v_credential public.restaurant_external_profile_credentials%rowtype;
begin
  if p_refresh_token_encrypted !~ '^gbp\.1\.[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$' or
     p_expected_refresh_token_encrypted !~ '^gbp\.1\.[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$' or
     p_refreshed_at > timezone('utc', now()) + interval '1 minute' or
     p_refreshed_at < timezone('utc', now()) - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'Credential refresh input is invalid';
  end if;

  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id is not distinct from p_expected_account_id
    and external_profile_id is not distinct from p_expected_profile_id
    and external_location_id is not distinct from p_expected_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if not found then raise no_data_found; end if;

  select * into strict v_credential
  from public.restaurant_external_profile_credentials
  where external_profile_id = p_external_profile_row_id
    and refresh_token_encrypted = p_expected_refresh_token_encrypted
  for update;

  update public.restaurant_external_profile_credentials
  set refresh_token_encrypted = p_refresh_token_encrypted,
      granted_scopes = public.array_sort_unique_text(p_granted_scopes),
      token_type = p_token_type, last_refreshed_at = p_refreshed_at,
      last_error = null, updated_at = timezone('utc', now())
  where external_profile_id = p_external_profile_row_id
    and refresh_token_encrypted = p_expected_refresh_token_encrypted
  returning * into strict v_credential;
  return v_credential;
end;
$$;

create or replace function public.link_gbp_notification_participation_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_managed_topic text, p_provider_notification_setting_id text default null
) returns public.gbp_notification_registries_v1
language plpgsql security definer set search_path = public as $$
declare v_registry public.gbp_notification_registries_v1%rowtype;
begin
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    and connection_status = 'linked'
  for update;
  if not found then raise exception using errcode = '42501', message = 'stale GBP notification fence'; end if;
  if p_managed_topic is null or length(p_managed_topic) > 500
    or p_managed_topic !~ '^projects/[A-Za-z0-9._:-]+/topics/[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'invalid GBP managed topic';
  end if;
  select * into v_registry from public.gbp_notification_registries_v1
  where provider = 'google_business_profile' and external_account_id = p_external_account_id
  for update;
  if found and v_registry.managed_topic <> p_managed_topic then
    raise exception using errcode = '23505', message = 'GBP account already has a different managed topic';
  end if;
  if not found then
    insert into public.gbp_notification_registries_v1 (
      provider, external_account_id, managed_topic, provider_notification_setting_id
    ) values ('google_business_profile', p_external_account_id, p_managed_topic,
      p_provider_notification_setting_id) returning * into v_registry;
  elsif p_provider_notification_setting_id is not null then
    update public.gbp_notification_registries_v1
    set provider_notification_setting_id = p_provider_notification_setting_id,
        updated_at = timezone('utc', now())
    where id = v_registry.id returning * into v_registry;
  end if;
  insert into public.gbp_notification_event_types_v1 (registry_id, event_type, managed_by_nabatable)
  values (v_registry.id, 'GOOGLE_UPDATE', true)
  on conflict (registry_id, event_type) do update
    set managed_by_nabatable = public.gbp_notification_event_types_v1.managed_by_nabatable;
  insert into public.gbp_notification_restaurant_links_v1 (
    registry_id, restaurant_id, external_profile_row_id, external_account_id,
    external_profile_id, external_location_id, connection_generation, consent_epoch
  ) values (v_registry.id, p_restaurant_id, p_external_profile_row_id,
    p_external_account_id, p_external_profile_id, p_external_location_id,
    p_connection_generation, p_consent_epoch)
  on conflict (registry_id, restaurant_id, external_profile_row_id) do update set
    external_account_id = excluded.external_account_id,
    external_profile_id = excluded.external_profile_id,
    external_location_id = excluded.external_location_id,
    connection_generation = excluded.connection_generation,
    consent_epoch = excluded.consent_epoch;
  select * into strict v_registry from public.gbp_notification_registries_v1 where id = v_registry.id;
  return v_registry;
end;
$$;

create or replace function public.unlink_gbp_notification_participation_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint
) returns public.gbp_notification_registries_v1
language plpgsql security definer set search_path = public as $$
declare v_registry public.gbp_notification_registries_v1%rowtype;
begin
  select r.* into strict v_registry
  from public.gbp_notification_registries_v1 r
  join public.gbp_notification_restaurant_links_v1 l on l.registry_id = r.id
  where l.restaurant_id = p_restaurant_id and l.external_profile_row_id = p_external_profile_row_id
    and l.external_account_id = p_external_account_id
    and l.external_profile_id = p_external_profile_id
    and l.external_location_id = p_external_location_id
    and l.connection_generation = p_connection_generation and l.consent_epoch = p_consent_epoch
  for update of r;
  delete from public.gbp_notification_restaurant_links_v1
  where registry_id = v_registry.id and restaurant_id = p_restaurant_id
    and external_profile_row_id = p_external_profile_row_id;
  select * into strict v_registry from public.gbp_notification_registries_v1 where id = v_registry.id;
  if v_registry.ref_count = 0 then
    delete from public.gbp_notification_event_types_v1
    where registry_id = v_registry.id and event_type = 'GOOGLE_UPDATE'
      and managed_by_nabatable;
  end if;
  return v_registry;
end;
$$;

create or replace function public.record_gbp_pubsub_and_enqueue_v1(
  p_subscription text, p_message_id text, p_event_hash text, p_event_type text,
  p_authentication_result text, p_processing_result text, p_registry_id uuid,
  p_restaurant_id uuid, p_external_profile_row_id uuid, p_external_account_id text,
  p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_idempotency_key text, p_received_at timestamptz
) returns public.gbp_pubsub_receipt_result_v1
language plpgsql security definer set search_path = public as $$
declare
  v_existing public.gbp_pubsub_receipts_v1%rowtype;
  v_link public.gbp_notification_restaurant_links_v1%rowtype;
  v_result text := p_processing_result;
  v_job_id uuid;
  v_inserted integer;
  v_return public.gbp_pubsub_receipt_result_v1;
begin
  if p_event_hash is null or p_event_hash !~ '^[a-f0-9]{64}$'
    or p_authentication_result not in ('verified','rejected','missing','invalid')
    or p_processing_result not in ('accepted','ignored','unmatched','poison','rejected','failed')
    or p_idempotency_key is null or length(p_idempotency_key) > 300
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$'
    or p_received_at < timezone('utc', now()) - interval '1 day'
    or p_received_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid GBP PubSub receipt envelope';
  end if;
  if p_authentication_result = 'verified' and p_event_type = 'GOOGLE_UPDATE'
    and p_processing_result = 'accepted' then
    select l.* into v_link
    from public.gbp_notification_restaurant_links_v1 l
    join public.restaurant_external_profiles p
      on p.restaurant_id = l.restaurant_id and p.id = l.external_profile_row_id
      and p.external_account_id = l.external_account_id
      and p.external_profile_id = l.external_profile_id
      and p.external_location_id = l.external_location_id
      and p.connection_generation = l.connection_generation and p.consent_epoch = l.consent_epoch
    where l.registry_id = p_registry_id and l.external_account_id = p_external_account_id
      and l.external_location_id = p_external_location_id and p.connection_status = 'linked'
    order by l.restaurant_id, l.external_profile_row_id limit 1 for update of p;
    if not found then
      v_result := 'unmatched';
    elsif (p_restaurant_id is not null and p_restaurant_id <> v_link.restaurant_id)
      or (p_external_profile_row_id is not null and p_external_profile_row_id <> v_link.external_profile_row_id)
      or (p_external_profile_id is not null and p_external_profile_id <> v_link.external_profile_id)
      or (p_connection_generation is not null and p_connection_generation <> v_link.connection_generation)
      or (p_consent_epoch is not null and p_consent_epoch <> v_link.consent_epoch) then
      raise exception using errcode = '42501', message = 'caller GBP PubSub fence mismatch';
    end if;
  elsif p_processing_result = 'accepted' then
    raise exception using errcode = '22023', message = 'only verified GOOGLE_UPDATE may be accepted';
  end if;
  insert into public.gbp_pubsub_receipts_v1 (
    subscription, message_id, registry_id, restaurant_id, external_profile_row_id,
    external_account_id, external_profile_id, external_location_id,
    connection_generation, consent_epoch, authentication_result, processing_result,
    event_type, event_hash, idempotency_key, reason_code, received_at, processed_at
  ) values (
    p_subscription, p_message_id, p_registry_id,
    case when v_result = 'accepted' then v_link.restaurant_id else null end,
    case when v_result = 'accepted' then v_link.external_profile_row_id else null end,
    case when v_result = 'accepted' then v_link.external_account_id else null end,
    case when v_result = 'accepted' then v_link.external_profile_id else null end,
    case when v_result = 'accepted' then v_link.external_location_id else null end,
    case when v_result = 'accepted' then v_link.connection_generation else null end,
    case when v_result = 'accepted' then v_link.consent_epoch else null end,
    p_authentication_result, v_result, p_event_type, p_event_hash, p_idempotency_key,
    case when v_result in ('poison','ignored','unmatched','rejected','failed') then v_result else null end,
    p_received_at, timezone('utc', now())
  ) on conflict (subscription, message_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into strict v_existing from public.gbp_pubsub_receipts_v1
    where subscription = p_subscription and message_id = p_message_id;
    v_return := row(v_existing.processing_result, false, v_existing.job_id);
    return v_return;
  end if;
  if v_result = 'accepted' then
    v_job_id := gen_random_uuid();
    insert into public.dual_sync_jobs (
      id, restaurant_id, provider, job_kind, status, idempotency_key, payload,
      priority, max_attempts, available_at, external_profile_id, external_account_id,
      external_location_id, connection_generation, consent_epoch
    ) values (
      v_job_id, v_link.restaurant_id, 'google_business_profile', 'google_refresh_manual',
      'queued', p_idempotency_key, jsonb_build_object(
        'eventId', p_message_id,
        'sourceReceiptSubscription', p_subscription,
        'sourceReceiptMessageId', p_message_id
      ), 40, 3, timezone('utc', now()),
      v_link.external_profile_id, v_link.external_account_id, v_link.external_location_id,
      v_link.connection_generation, v_link.consent_epoch
    );
    update public.gbp_pubsub_receipts_v1 set job_id = v_job_id
    where subscription = p_subscription and message_id = p_message_id;
  end if;
  v_return := row(v_result, true, v_job_id);
  return v_return;
end;
$$;

create or replace function public.enqueue_gbp_scheduled_refreshes_v1(
  p_now timestamptz, p_bucket timestamptz, p_limit integer default 50
) returns setof public.gbp_scheduled_refresh_result_v1
language plpgsql security definer set search_path = public as $$
declare v_profile public.restaurant_external_profiles%rowtype; v_job_id uuid; v_created boolean; v_inserted integer;
  v_result public.gbp_scheduled_refresh_result_v1; v_key text;
begin
  if p_limit < 1 or p_limit > 50
    or p_bucket <> to_timestamp(floor(extract(epoch from p_bucket) / 1800) * 1800)
    or p_bucket > p_now or p_bucket < p_now - interval '1 hour' then
    raise exception using errcode = '22023', message = 'invalid GBP scheduled refresh bucket';
  end if;
  for v_profile in
    select p.* from public.restaurant_external_profiles p
    where p.provider = 'google_business_profile' and p.connection_status = 'linked'
      and p.external_account_id is not null and p.external_profile_id is not null
      and p.external_location_id is not null
    order by p.restaurant_id, p.id for update skip locked limit p_limit
  loop
    v_job_id := gen_random_uuid();
    v_key := 'gbp-scheduled:' || extract(epoch from p_bucket)::bigint::text;
    insert into public.dual_sync_jobs (
      id, restaurant_id, provider, job_kind, status, idempotency_key, payload,
      priority, max_attempts, available_at, external_profile_id, external_account_id,
      external_location_id, connection_generation, consent_epoch
    ) values (
      v_job_id, v_profile.restaurant_id, 'google_business_profile',
      'google_refresh_scheduled', 'queued', v_key, '{}'::jsonb, 100, 3, p_now,
      v_profile.external_profile_id, v_profile.external_account_id,
      v_profile.external_location_id, v_profile.connection_generation, v_profile.consent_epoch
    ) on conflict (restaurant_id, provider, job_kind, idempotency_key)
      where idempotency_key is not null do nothing;
    get diagnostics v_inserted = row_count;
    v_created := v_inserted > 0;
    if not v_created then
      select id into strict v_job_id from public.dual_sync_jobs
      where restaurant_id = v_profile.restaurant_id and provider = 'google_business_profile'
        and job_kind = 'google_refresh_scheduled' and idempotency_key = v_key;
    end if;
    v_result := row(v_profile.restaurant_id, v_job_id, v_created);
    return next v_result;
  end loop;
end;
$$;

create or replace function public.upsert_gbp_pending_update_masks_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint, p_event_id text,
  p_location_masks text[], p_attribute_paths text[],
  p_source_receipt_subscription text, p_source_receipt_message_id text,
  p_source_job_id uuid, p_observed_at timestamptz, p_expires_at timestamptz
) returns public.gbp_pending_update_masks_v1
language plpgsql security definer set search_path = public as $$
declare v_row public.gbp_pending_update_masks_v1%rowtype;
begin
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile' and external_account_id = p_external_account_id
    and external_profile_id = p_external_profile_id and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    and connection_status = 'linked' for update;
  if not found then raise exception using errcode = '42501', message = 'stale GBP mask fence'; end if;
  if p_location_masks is null or p_attribute_paths is null
    or array_position(p_location_masks, null) is not null
    or array_position(p_attribute_paths, null) is not null
    or p_location_masks <> public.array_sort_unique_text(p_location_masks)
    or p_attribute_paths <> public.array_sort_unique_text(p_attribute_paths)
    or cardinality(p_location_masks) + cardinality(p_attribute_paths) = 0
    or exists (select 1 from unnest(p_location_masks || p_attribute_paths) value
      where value !~ '^[A-Za-z][A-Za-z0-9._/-]{0,199}$')
    or p_observed_at < timezone('utc', now()) - interval '15 minutes'
    or p_observed_at > timezone('utc', now()) + interval '1 minute'
    or p_expires_at > p_observed_at + interval '28 days' then
    raise exception using errcode = '22023', message = 'invalid GBP update mask overlay';
  end if;
  insert into public.gbp_pending_update_masks_v1 (
    restaurant_id, external_profile_row_id, external_account_id, external_profile_id,
    external_location_id, connection_generation, consent_epoch, event_id,
    location_masks, attribute_paths, source_receipt_subscription,
    source_receipt_message_id, source_job_id, observed_at, expires_at
  ) values (
    p_restaurant_id, p_external_profile_row_id, p_external_account_id,
    p_external_profile_id, p_external_location_id, p_connection_generation,
    p_consent_epoch, p_event_id, p_location_masks, p_attribute_paths,
    p_source_receipt_subscription, p_source_receipt_message_id, p_source_job_id,
    p_observed_at, p_expires_at
  ) on conflict (restaurant_id, external_profile_row_id, connection_generation, consent_epoch, event_id)
  do update set
    location_masks = public.array_sort_unique_text(
      public.gbp_pending_update_masks_v1.location_masks || excluded.location_masks),
    attribute_paths = public.array_sort_unique_text(
      public.gbp_pending_update_masks_v1.attribute_paths || excluded.attribute_paths),
    source_receipt_subscription = coalesce(excluded.source_receipt_subscription,
      public.gbp_pending_update_masks_v1.source_receipt_subscription),
    source_receipt_message_id = coalesce(excluded.source_receipt_message_id,
      public.gbp_pending_update_masks_v1.source_receipt_message_id),
    source_job_id = coalesce(excluded.source_job_id, public.gbp_pending_update_masks_v1.source_job_id),
    observed_at = excluded.observed_at, expires_at = excluded.expires_at,
    status = 'pending', terminal_at = null, updated_at = timezone('utc', now())
  where public.gbp_pending_update_masks_v1.status = 'pending'
  returning * into v_row;
  if not found then raise exception using errcode = '55000', message = 'terminal GBP mask overlay cannot reopen'; end if;
  return v_row;
end;
$$;

create or replace function public.read_gbp_pending_update_masks_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_now timestamptz default timezone('utc', now())
) returns setof public.gbp_pending_update_masks_v1
language sql security definer stable set search_path = public as $$
  select m.* from public.gbp_pending_update_masks_v1 m
  join public.restaurant_external_profiles p
    on p.restaurant_id = m.restaurant_id and p.id = m.external_profile_row_id
  where m.restaurant_id = p_restaurant_id and m.external_profile_row_id = p_external_profile_row_id
    and m.external_account_id = p_external_account_id
    and m.external_profile_id = p_external_profile_id
    and m.external_location_id = p_external_location_id
    and m.connection_generation = p_connection_generation and m.consent_epoch = p_consent_epoch
    and p.external_account_id = m.external_account_id and p.external_profile_id = m.external_profile_id
    and p.external_location_id = m.external_location_id
    and p.connection_generation = m.connection_generation and p.consent_epoch = m.consent_epoch
    and p.connection_status = 'linked' and m.status = 'pending' and m.expires_at > p_now
  order by m.observed_at, m.id;
$$;

create or replace function public.terminalize_gbp_pending_update_masks_v1(
  p_restaurant_id uuid, p_external_profile_row_id uuid,
  p_external_account_id text, p_external_profile_id text, p_external_location_id text,
  p_connection_generation bigint, p_consent_epoch bigint,
  p_event_id text, p_terminal_status text, p_terminal_at timestamptz
) returns public.gbp_pending_update_masks_v1
language plpgsql security definer set search_path = public as $$
declare v_row public.gbp_pending_update_masks_v1%rowtype;
begin
  if p_terminal_status not in ('applied','stale','failed') then
    raise exception using errcode = '22023', message = 'invalid GBP mask terminal status';
  end if;
  perform 1 from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and external_account_id = p_external_account_id and external_profile_id = p_external_profile_id
    and external_location_id = p_external_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;
  if not found then raise exception using errcode = '42501', message = 'stale GBP mask terminal fence'; end if;
  update public.gbp_pending_update_masks_v1 set status = p_terminal_status,
    terminal_at = p_terminal_at, updated_at = timezone('utc', now())
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
    and event_id = p_event_id and status = 'pending'
  returning * into v_row;
  if not found then raise no_data_found; end if;
  return v_row;
end;
$$;

create or replace function public.materialize_gbp_terminal_notice_v1(
  p_restaurant_id uuid, p_grant_id uuid, p_event_id text,
  p_terminal_kind text, p_safe_reason_code text, p_terminal_at timestamptz
) returns public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
declare v_grant public.gbp_write_grants_v1%rowtype; v_row public.gbp_terminal_outcome_notices_v1%rowtype;
begin
  if p_terminal_kind not in ('consumed','failed','outcome_unknown')
    or p_safe_reason_code is null or p_safe_reason_code !~ '^[a-z0-9_:-]{1,100}$' then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice';
  end if;
  select * into strict v_grant from public.gbp_write_grants_v1
  where restaurant_id = p_restaurant_id and id = p_grant_id for update;
  if v_grant.status <> p_terminal_kind or v_grant.terminal_at is null
    or v_grant.terminal_at is distinct from p_terminal_at then
    raise exception using errcode = '42501', message = 'GBP terminal notice does not match grant';
  end if;
  insert into public.gbp_terminal_outcome_notices_v1 (
    restaurant_id, grant_id, event_id, terminal_kind, safe_reason_code,
    requires_fresh_preview, terminal_at, due_at, available_at
  ) values (
    p_restaurant_id, p_grant_id, p_event_id, p_terminal_kind, p_safe_reason_code,
    p_terminal_kind = 'outcome_unknown', p_terminal_at,
    p_terminal_at + interval '48 hours', timezone('utc', now())
  ) on conflict (restaurant_id, grant_id) do update set
    safe_reason_code = public.gbp_terminal_outcome_notices_v1.safe_reason_code
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.claim_gbp_terminal_notices_v1(
  p_worker_id text, p_limit integer default 50, p_lease_seconds integer default 60,
  p_now timestamptz default timezone('utc', now())
) returns setof public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,100}$'
    or p_limit < 1 or p_limit > 100 or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice claim';
  end if;
  update public.gbp_terminal_outcome_notices_v1 set status = 'pending', claimed_by = null,
    lease_token = null, lease_expires_at = null, available_at = p_now,
    updated_at = p_now
  where status = 'claimed' and lease_expires_at <= p_now;
  return query
  with targets as (
    select id from public.gbp_terminal_outcome_notices_v1
    where status = 'pending' and available_at <= p_now and attempt_count < max_attempts
    order by due_at, created_at, id for update skip locked limit p_limit
  )
  update public.gbp_terminal_outcome_notices_v1 n set status = 'claimed',
    claimed_by = p_worker_id, lease_token = gen_random_uuid(),
    lease_expires_at = p_now + make_interval(secs => p_lease_seconds),
    attempt_count = n.attempt_count + 1, updated_at = p_now
  from targets where n.id = targets.id returning n.*;
end;
$$;

create or replace function public.reconcile_missing_gbp_terminal_notices_v1(
  p_limit integer default 50,
  p_now timestamptz default timezone('utc', now())
) returns setof public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
begin
  if p_limit < 1 or p_limit > 100 or p_now is null
    or p_now < timezone('utc', now()) - interval '5 minutes'
    or p_now > timezone('utc', now()) + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice reconciliation';
  end if;
  return query
  with missing as materialized (
    select g.restaurant_id, g.id as grant_id, g.status as terminal_kind, g.terminal_at
    from public.gbp_write_grants_v1 g
    left join public.gbp_terminal_outcome_notices_v1 n
      on n.restaurant_id = g.restaurant_id and n.grant_id = g.id
    where g.status in ('consumed','failed','outcome_unknown')
      and g.terminal_at is not null and n.id is null
    order by g.terminal_at, g.id
    for update of g skip locked
    limit p_limit
  ), inserted as (
    insert into public.gbp_terminal_outcome_notices_v1 (
      restaurant_id, grant_id, event_id, terminal_kind, safe_reason_code,
      requires_fresh_preview, terminal_at, due_at, available_at
    )
    select m.restaurant_id, m.grant_id, 'grant:' || m.grant_id::text,
      m.terminal_kind, 'terminal_grant_reconciled',
      m.terminal_kind = 'outcome_unknown', m.terminal_at,
      m.terminal_at + interval '48 hours', p_now
    from missing m
    on conflict do nothing
    returning *
  )
  select i.* from inserted i order by i.terminal_at, i.grant_id;
end;
$$;

create or replace function public.finalize_gbp_terminal_notice_v1(
  p_restaurant_id uuid, p_notice_id uuid, p_worker_id text, p_lease_token uuid,
  p_outcome text, p_safe_error_code text default null,
  p_now timestamptz default timezone('utc', now())
) returns public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
declare v_row public.gbp_terminal_outcome_notices_v1%rowtype;
begin
  if p_outcome not in ('delivered','retryable_failure','terminal_failure')
    or (p_outcome = 'delivered' and p_safe_error_code is not null)
    or (p_outcome <> 'delivered' and (p_safe_error_code is null
      or p_safe_error_code !~ '^[a-z0-9_:-]{1,100}$')) then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice result';
  end if;
  select * into strict v_row from public.gbp_terminal_outcome_notices_v1
  where id = p_notice_id and restaurant_id = p_restaurant_id and status = 'claimed'
    and claimed_by = p_worker_id and lease_token = p_lease_token and lease_expires_at > p_now
  for update;
  if p_outcome = 'delivered' then
    update public.gbp_terminal_outcome_notices_v1 set status = 'delivered',
      delivered_at = p_now, claimed_by = null, lease_token = null, lease_expires_at = null,
      last_error_code = null, updated_at = p_now where id = p_notice_id returning * into v_row;
  elsif p_outcome = 'retryable_failure' and v_row.attempt_count < v_row.max_attempts then
    update public.gbp_terminal_outcome_notices_v1 set status = 'pending',
      available_at = p_now + make_interval(secs => least(3600, 30 * (2 ^ greatest(0, attempt_count - 1))::integer)),
      claimed_by = null, lease_token = null, lease_expires_at = null,
      last_error_code = p_safe_error_code, updated_at = p_now
    where id = p_notice_id returning * into v_row;
  else
    update public.gbp_terminal_outcome_notices_v1 set status = 'failed', failed_at = p_now,
      claimed_by = null, lease_token = null, lease_expires_at = null,
      last_error_code = p_safe_error_code, updated_at = p_now
    where id = p_notice_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.get_gbp_terminal_notice_census_v1(
  p_restaurant_id uuid default null, p_now timestamptz default timezone('utc', now())
) returns public.gbp_terminal_notice_census_v1
language sql security definer stable set search_path = public as $$
  select row(
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('pending','claimed','dispatched') and due_at < p_now),
    count(*) filter (where status = 'claimed'),
    count(*) filter (where status = 'dispatched'),
    count(*) filter (where status = 'outcome_unknown'),
    count(*) filter (where status = 'delivered'),
    count(*) filter (where status = 'failed'),
    min(created_at) filter (where status in ('pending','claimed','dispatched'))
  )::public.gbp_terminal_notice_census_v1
  from public.gbp_terminal_outcome_notices_v1
  where p_restaurant_id is null or restaurant_id = p_restaurant_id;
$$;

create or replace function public.dispatch_gbp_terminal_notice_v1(
  p_restaurant_id uuid, p_notice_id uuid, p_worker_id text, p_lease_token uuid,
  p_dispatch_key text, p_now timestamptz default timezone('utc', now())
) returns public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
declare v_row public.gbp_terminal_outcome_notices_v1%rowtype;
begin
  if p_dispatch_key is null
    or p_dispatch_key <> 'gbp-terminal:' || p_notice_id::text || ':' || p_lease_token::text then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice dispatch key';
  end if;
  select * into strict v_row from public.gbp_terminal_outcome_notices_v1
  where restaurant_id = p_restaurant_id and id = p_notice_id and status = 'claimed'
    and claimed_by = p_worker_id and lease_token = p_lease_token and lease_expires_at > p_now
  for update;
  insert into public.gbp_terminal_notice_delivery_attempts_v1 (
    restaurant_id, notice_id, attempt_number, channel, dispatch_key,
    worker_id, lease_token, dispatched_at
  ) values (
    p_restaurant_id, p_notice_id, v_row.attempt_count, 'operational_event',
    p_dispatch_key, p_worker_id, p_lease_token, p_now
  );
  update public.gbp_terminal_outcome_notices_v1 set status = 'dispatched',
    delivery_channel = 'operational_event', dispatch_key = p_dispatch_key,
    dispatched_at = p_now, updated_at = p_now
  where id = p_notice_id returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.finalize_gbp_terminal_notice_v1(
  p_restaurant_id uuid, p_notice_id uuid, p_worker_id text, p_lease_token uuid,
  p_outcome text, p_safe_error_code text default null,
  p_now timestamptz default timezone('utc', now())
) returns public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
declare v_row public.gbp_terminal_outcome_notices_v1%rowtype; v_attempt_status text;
begin
  if p_outcome not in ('delivered','retryable_failure','terminal_failure','outcome_unknown')
    or (p_outcome = 'delivered' and p_safe_error_code is not null)
    or (p_outcome <> 'delivered' and (p_safe_error_code is null
      or p_safe_error_code !~ '^[a-z0-9_:-]{1,100}$')) then
    raise exception using errcode = '22023', message = 'invalid GBP terminal notice result';
  end if;
  select * into strict v_row from public.gbp_terminal_outcome_notices_v1
  where id = p_notice_id and restaurant_id = p_restaurant_id and status = 'dispatched'
    and claimed_by = p_worker_id and lease_token = p_lease_token
  for update;
  v_attempt_status := case p_outcome
    when 'delivered' then 'delivered'
    when 'outcome_unknown' then 'outcome_unknown'
    else 'definitive_rejection' end;
  update public.gbp_terminal_notice_delivery_attempts_v1
  set status = v_attempt_status, terminal_at = p_now,
      safe_error_code = p_safe_error_code, updated_at = p_now
  where notice_id = p_notice_id and attempt_number = v_row.attempt_count
    and worker_id = p_worker_id and lease_token = p_lease_token and status = 'dispatched';
  if not found then raise no_data_found; end if;
  if p_outcome = 'delivered' then
    update public.gbp_terminal_outcome_notices_v1 set status = 'delivered',
      delivered_at = p_now, claimed_by = null, lease_token = null, lease_expires_at = null,
      last_error_code = null, updated_at = p_now where id = p_notice_id returning * into v_row;
  elsif p_outcome = 'retryable_failure' and v_row.attempt_count < v_row.max_attempts then
    update public.gbp_terminal_outcome_notices_v1 set status = 'pending',
      available_at = p_now + make_interval(secs => least(3600, 30 * (2 ^ greatest(0, attempt_count - 1))::integer)),
      claimed_by = null, lease_token = null, lease_expires_at = null,
      delivery_channel = null, dispatch_key = null, dispatched_at = null,
      last_error_code = p_safe_error_code, updated_at = p_now
    where id = p_notice_id returning * into v_row;
  elsif p_outcome = 'outcome_unknown' then
    update public.gbp_terminal_outcome_notices_v1 set status = 'outcome_unknown',
      outcome_unknown_at = p_now, claimed_by = null, lease_token = null,
      lease_expires_at = null, last_error_code = p_safe_error_code, updated_at = p_now
    where id = p_notice_id returning * into v_row;
  else
    update public.gbp_terminal_outcome_notices_v1 set status = 'failed', failed_at = p_now,
      claimed_by = null, lease_token = null, lease_expires_at = null,
      last_error_code = p_safe_error_code, updated_at = p_now
    where id = p_notice_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.recover_stale_gbp_dispatched_notices_v1(
  p_limit integer default 50, p_now timestamptz default timezone('utc', now())
) returns setof public.gbp_terminal_outcome_notices_v1
language plpgsql security definer set search_path = public as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'invalid GBP dispatched notice recovery limit';
  end if;
  return query
  with targets as (
    select id, attempt_count from public.gbp_terminal_outcome_notices_v1
    where status = 'dispatched' and lease_expires_at <= p_now
    order by dispatched_at, id for update skip locked limit p_limit
  ), attempts as (
    update public.gbp_terminal_notice_delivery_attempts_v1 a
    set status = 'outcome_unknown', terminal_at = p_now,
      safe_error_code = 'dispatch_finalize_missing', updated_at = p_now
    from targets t where a.notice_id = t.id and a.attempt_number = t.attempt_count
      and a.status = 'dispatched' returning a.notice_id
  )
  update public.gbp_terminal_outcome_notices_v1 n set status = 'outcome_unknown',
    outcome_unknown_at = p_now, claimed_by = null, lease_token = null,
    lease_expires_at = null, last_error_code = 'dispatch_finalize_missing', updated_at = p_now
  from targets t join attempts a on a.notice_id = t.id
  where n.id = t.id returning n.*;
end;
$$;

create or replace function public.get_gbp_terminal_notice_census_v1(
  p_restaurant_id uuid default null, p_now timestamptz default timezone('utc', now())
) returns public.gbp_terminal_notice_census_v1
language sql security definer stable set search_path = public as $$
  select row(
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('pending','claimed','dispatched') and due_at < p_now),
    count(*) filter (where status = 'claimed'),
    count(*) filter (where status = 'dispatched'),
    count(*) filter (where status = 'outcome_unknown'),
    count(*) filter (where status = 'delivered'),
    count(*) filter (where status = 'failed'),
    min(created_at) filter (where status in ('pending','claimed','dispatched'))
  )::public.gbp_terminal_notice_census_v1
  from public.gbp_terminal_outcome_notices_v1
  where p_restaurant_id is null or restaurant_id = p_restaurant_id;
$$;

create or replace function public.disconnect_gbp_connection_v1(
  p_restaurant_id uuid,
  p_external_profile_row_id uuid,
  p_expected_account_id text,
  p_expected_profile_id text,
  p_expected_location_id text,
  p_connection_generation bigint,
  p_consent_epoch bigint,
  p_reason_code text,
  p_actor_user_id uuid
)
returns public.restaurant_external_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row public.restaurant_external_profiles%rowtype;
begin
  perform 1 from public.restaurants where id = p_restaurant_id for update;
  if not found then raise no_data_found; end if;
  select * into strict v_row
  from public.restaurant_external_profiles
  where id = p_external_profile_row_id and restaurant_id = p_restaurant_id
    and provider = 'google_business_profile'
    and external_account_id is not distinct from p_expected_account_id
    and external_profile_id is not distinct from p_expected_profile_id
    and external_location_id is not distinct from p_expected_location_id
    and connection_generation = p_connection_generation and consent_epoch = p_consent_epoch
  for update;

  update public.restaurant_external_profiles
  set write_state = 'revoking', push_enabled = false,
      write_state_reason_code = p_reason_code, write_state_actor_user_id = p_actor_user_id,
      write_state_changed_at = timezone('utc', now())
  where id = p_external_profile_row_id;
  perform public.purge_gbp_profile_content_v1(
    p_restaurant_id, p_external_profile_row_id, p_expected_account_id,
    p_expected_profile_id, p_expected_location_id,
    p_connection_generation, p_consent_epoch
  );

  delete from public.gbp_notification_restaurant_links_v1
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id;
  delete from public.restaurant_external_profile_credentials
  where external_profile_id = p_external_profile_row_id;
  update public.gbp_write_grants_v1
  set status = case when status = 'dispatched' then 'outcome_unknown'
                    when status = 'claimed' then 'cancelled_before_dispatch' else 'revoked' end,
      terminal_at = timezone('utc', now()), reason_code = p_reason_code
  where restaurant_id = p_restaurant_id and external_profile_row_id = p_external_profile_row_id
    and status in ('granted', 'claimed', 'dispatched');
  update public.dual_sync_jobs
  set status = 'cancelled', finished_at = timezone('utc', now()), last_error_code = p_reason_code
  where restaurant_id = p_restaurant_id and provider = 'google_business_profile'
    and status in ('queued', 'running', 'retrying')
    and (consent_epoch is null or consent_epoch <= p_consent_epoch)
    and (
      (job_kind in ('publish_batch', 'auto_export') and
        (external_profile_id is null or external_profile_id is not distinct from p_expected_profile_id))
      or
      (job_kind not in ('publish_batch', 'auto_export') and external_profile_id is not null and
        external_profile_id is not distinct from p_expected_profile_id)
    );
  update public.restaurant_external_profiles
  set external_account_id = null, external_profile_id = null, external_location_id = null,
      external_account_name = null, external_location_name = null,
      external_location_title = null, external_resource_name = null,
      external_place_id = null, connection_status = 'unlinked', write_state = 'disconnected',
      connection_generation = connection_generation + 1, consent_epoch = consent_epoch + 1,
      push_enabled = false, write_state_reason_code = p_reason_code,
      write_state_actor_user_id = p_actor_user_id,
      write_state_changed_at = timezone('utc', now()), last_error = null,
      last_pull_at = null, last_push_at = null, updated_at = timezone('utc', now())
  where id = p_external_profile_row_id
  returning * into v_row;
  return v_row;
end;
$$;

alter table public.gbp_write_rollout_config_v1 enable row level security;
alter table public.gbp_write_canary_restaurants_v1 enable row level security;
alter table public.gbp_write_allowlist_v1 enable row level security;
alter table public.gbp_write_policy_config_v1 enable row level security;
alter table public.gbp_write_readiness_evidence_v1 enable row level security;
alter table public.gbp_write_grants_v1 enable row level security;
alter table public.gbp_consent_events_v1 enable row level security;
alter table public.gbp_notification_registries_v1 enable row level security;
alter table public.gbp_notification_event_types_v1 enable row level security;
alter table public.gbp_notification_restaurant_links_v1 enable row level security;
alter table public.gbp_pubsub_receipts_v1 enable row level security;
alter table public.gbp_pending_update_masks_v1 enable row level security;
alter table public.gbp_terminal_outcome_notices_v1 enable row level security;
alter table public.gbp_terminal_notice_delivery_attempts_v1 enable row level security;
alter table public.gbp_field_provenance_v1 enable row level security;
alter table public.gbp_core_change_outbox_v1 enable row level security;
alter table public.gbp_content_lineage_v1 enable row level security;

create policy gbp_write_rollout_config_v1_service_role on public.gbp_write_rollout_config_v1 for all to service_role using (true) with check (true);
create policy gbp_write_canary_restaurants_v1_service_role on public.gbp_write_canary_restaurants_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_write_allowlist_v1_service_role on public.gbp_write_allowlist_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_write_policy_config_v1_service_role on public.gbp_write_policy_config_v1 for all to service_role using (true) with check (true);
create policy gbp_write_readiness_evidence_v1_service_role on public.gbp_write_readiness_evidence_v1 for select to service_role using (true);
create policy gbp_write_grants_v1_service_role on public.gbp_write_grants_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_consent_events_v1_service_role on public.gbp_consent_events_v1 for insert to service_role with check (restaurant_id is not null);
create policy gbp_notification_registries_v1_service_role on public.gbp_notification_registries_v1 for all to service_role using (true) with check (true);
create policy gbp_notification_event_types_v1_service_role on public.gbp_notification_event_types_v1 for all to service_role using (registry_id is not null) with check (registry_id is not null);
create policy gbp_notification_restaurant_links_v1_service_role on public.gbp_notification_restaurant_links_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_pubsub_receipts_v1_service_role on public.gbp_pubsub_receipts_v1 for all to service_role using (restaurant_id is null or restaurant_id is not null) with check (restaurant_id is null or restaurant_id is not null);
create policy gbp_pending_update_masks_v1_service_role on public.gbp_pending_update_masks_v1 for select to service_role using (restaurant_id is not null);
create policy gbp_terminal_outcome_notices_v1_service_role on public.gbp_terminal_outcome_notices_v1 for select to service_role using (restaurant_id is not null);
create policy gbp_terminal_notice_delivery_attempts_v1_service_role on public.gbp_terminal_notice_delivery_attempts_v1 for select to service_role using (restaurant_id is not null);
create policy gbp_field_provenance_v1_service_role on public.gbp_field_provenance_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_core_change_outbox_v1_service_role on public.gbp_core_change_outbox_v1 for all to service_role using (restaurant_id is not null) with check (restaurant_id is not null);
create policy gbp_content_lineage_v1_service_role on public.gbp_content_lineage_v1 for select to service_role using (restaurant_id is not null);

revoke all on public.gbp_write_rollout_config_v1, public.gbp_write_canary_restaurants_v1, public.gbp_write_allowlist_v1, public.gbp_write_policy_config_v1, public.gbp_write_readiness_evidence_v1, public.gbp_write_grants_v1, public.gbp_consent_events_v1, public.gbp_notification_registries_v1, public.gbp_notification_event_types_v1, public.gbp_notification_restaurant_links_v1, public.gbp_pubsub_receipts_v1, public.gbp_field_provenance_v1, public.gbp_core_change_outbox_v1 from public, anon, authenticated;
revoke all on public.gbp_pending_update_masks_v1, public.gbp_terminal_outcome_notices_v1 from public, anon, authenticated;
revoke all on public.gbp_terminal_notice_delivery_attempts_v1 from public, anon, authenticated;
revoke all on public.gbp_content_lineage_v1 from public, anon, authenticated;
revoke insert, update, delete, truncate on public.gbp_content_lineage_v1 from service_role;
grant select on public.gbp_content_lineage_v1 to service_role;
revoke insert, update, delete, truncate on public.dual_sync_google_request_log_archives from service_role;
revoke insert, update, delete, truncate on public.restaurant_external_profile_snapshots,
  public.dual_sync_snapshot_runs, public.restaurant_gbp_food_menu_snapshots from service_role;
grant select on public.restaurant_external_profile_snapshots,
  public.dual_sync_snapshot_runs, public.restaurant_gbp_food_menu_snapshots to service_role;
revoke insert, update, delete, truncate on public.gbp_write_grants_v1 from service_role;
grant select on public.gbp_write_grants_v1 to service_role;
grant select, insert on public.gbp_consent_events_v1 to service_role;
grant select, insert, update, delete on public.gbp_write_rollout_config_v1, public.gbp_write_canary_restaurants_v1, public.gbp_write_allowlist_v1, public.gbp_write_policy_config_v1 to service_role;
revoke insert, update, delete, truncate on public.gbp_notification_registries_v1, public.gbp_notification_event_types_v1, public.gbp_notification_restaurant_links_v1, public.gbp_pubsub_receipts_v1, public.gbp_pending_update_masks_v1, public.gbp_terminal_outcome_notices_v1 from service_role;
revoke insert, update, delete, truncate on public.gbp_terminal_notice_delivery_attempts_v1 from service_role;
revoke insert, update, delete, truncate on public.gbp_pubsub_receipts_v1 from service_role;
grant select on public.gbp_notification_registries_v1, public.gbp_notification_event_types_v1, public.gbp_notification_restaurant_links_v1, public.gbp_pubsub_receipts_v1, public.gbp_pending_update_masks_v1, public.gbp_terminal_outcome_notices_v1 to service_role;
grant select on public.gbp_terminal_notice_delivery_attempts_v1 to service_role;
revoke insert, update, delete, truncate on public.gbp_write_readiness_evidence_v1 from service_role;
grant select on public.gbp_write_readiness_evidence_v1 to service_role;
grant select on public.gbp_field_provenance_v1, public.gbp_core_change_outbox_v1 to service_role;
revoke insert, update, delete, truncate on public.gbp_core_change_outbox_v1 from service_role;
revoke all on public.restaurant_external_profile_oauth_states from public, anon, authenticated;
revoke insert, update, delete, truncate on public.restaurant_external_profile_oauth_states from service_role;
grant select on public.restaurant_external_profile_oauth_states to service_role;
revoke all on public.restaurant_external_profile_credentials from public, anon, authenticated;
revoke insert, update, delete, truncate on public.restaurant_external_profile_credentials from service_role;
grant select on public.restaurant_external_profile_credentials to service_role;

revoke all on function public.reject_gbp_append_only_mutation_v1() from public, anon, authenticated;
revoke all on function public.enqueue_gbp_core_change_v1() from public, anon, authenticated;
revoke all on function public.enqueue_gbp_restaurants_change_v1() from public, anon, authenticated;
revoke all on function public.enqueue_gbp_operating_hours_change_v1() from public, anon, authenticated;
revoke all on function public.enqueue_gbp_service_period_change_v1() from public, anon, authenticated;
revoke all on function public.apply_gbp_profile_import_to_core_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.array_sort_unique_text(text[]) from public, anon, authenticated;
revoke all on function public.all_sha256_text(text[]) from public, anon, authenticated;
revoke all on function public.guard_gbp_grant_transition_v1() from public, anon, authenticated;
revoke all on function public.record_gbp_grant_created_v1() from public, anon, authenticated;
revoke all on function public.reject_gbp_readiness_mutation_v1() from public, anon, authenticated;
revoke all on function public.set_gbp_readiness_hash_v1() from public, anon, authenticated, service_role;
revoke all on function public.guard_gbp_field_provenance_v1() from public, anon, authenticated;
revoke all on function public.refresh_gbp_notification_ref_count_v1() from public, anon, authenticated;
revoke all on function public.guard_gbp_mutation_job_v1() from public, anon, authenticated;
revoke all on function public.get_gbp_content_retention_readiness_v1(timestamptz) from public, anon, authenticated;
revoke all on function public.record_gbp_content_observation_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid, text[], text[], timestamptz) from public, anon, authenticated;
revoke all on function public.inherit_gbp_content_lineage_v1(uuid, uuid, bigint, bigint, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.run_gbp_content_retention_v1(timestamptz, integer, integer, boolean, uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.purge_gbp_profile_content_v1(uuid, uuid, text, text, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.persist_gbp_external_profile_snapshot_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_current_gbp_external_profile_snapshots_v1(uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.persist_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.begin_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_current_gbp_dual_sync_snapshot_runs_v1(uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.persist_gbp_food_menu_snapshot_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_current_gbp_food_menu_snapshots_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.issue_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[]) from public, anon, authenticated;
revoke all on function public.issue_and_enqueue_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[], uuid) from public, anon, authenticated;
revoke all on function public.issue_and_claim_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[], uuid) from public, anon, authenticated;
revoke all on function public.claim_gbp_write_bundle_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, uuid[], text, text[], text[], text[], text[], text, text, uuid) from public, anon, authenticated;
revoke all on function public.dispatch_gbp_write_bundle_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_gbp_write_bundle_v1(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.dispatch_gbp_write_grant_v1(uuid, uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.finalize_gbp_write_grant_v1(uuid, uuid, uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.recover_stale_gbp_dispatched_grants_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.cancel_gbp_claimed_bundle_before_dispatch_v1(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.expire_gbp_write_grants_v1(integer) from public, anon, authenticated;
revoke all on function public.transition_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, uuid) from public, anon, authenticated;
revoke all on function public.transition_gbp_connection_provider_failure_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.set_gbp_write_access_v1(uuid, uuid, text, text, text, bigint, bigint, boolean, uuid) from public, anon, authenticated;
revoke all on function public.rebind_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.record_gbp_provider_observation_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_gbp_core_changes_v1(text, integer) from public, anon, authenticated;
revoke all on function public.complete_gbp_core_change_v1(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_gbp_core_changes_v1(text, integer) from service_role;
revoke all on function public.complete_gbp_core_change_v1(uuid, uuid, text, boolean) from service_role;
revoke all on function public.claim_gbp_core_changes_v2(text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_gbp_core_change_v2(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_gbp_core_outbox_census_v1(uuid) from public, anon, authenticated;
revoke all on function public.repair_gbp_core_change_v1(uuid, uuid, text, uuid, boolean, boolean, text, uuid, text, text[], text, text) from public, anon, authenticated;
revoke all on function public.create_gbp_oauth_attempt_v1(uuid, uuid, text, text, text, timestamptz, uuid, text, text, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.consume_gbp_oauth_attempt_v1(uuid, text, text, uuid, text, text, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.complete_gbp_oauth_identity_v1(uuid, text, text, uuid, uuid, text, text, text, text, text[], text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.refresh_gbp_credential_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, text[], text, timestamptz) from public, anon, authenticated;
revoke all on function public.disconnect_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.link_gbp_notification_participation_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.unlink_gbp_notification_participation_v1(uuid, uuid, text, text, text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.record_gbp_pubsub_and_enqueue_v1(text, text, text, text, text, text, uuid, uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.enqueue_gbp_scheduled_refreshes_v1(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.upsert_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, text, text[], text[], text, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.read_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.terminalize_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.materialize_gbp_terminal_notice_v1(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.dispatch_gbp_terminal_notice_v1(uuid, uuid, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.recover_stale_gbp_dispatched_notices_v1(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_gbp_terminal_notices_v1(text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_gbp_terminal_notice_v1(uuid, uuid, text, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_gbp_terminal_notice_census_v1(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.reconcile_missing_gbp_terminal_notices_v1(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_gbp_write_bundle_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, uuid[], text, text[], text[], text[], text[], text, text, uuid) to service_role;
grant execute on function public.issue_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[]) to service_role;
grant execute on function public.issue_and_enqueue_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[], uuid) to service_role;
grant execute on function public.issue_and_claim_gbp_write_bundle_v1(uuid, uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, text, timestamptz, timestamptz, public.gbp_write_grant_issue_v1[], uuid) to service_role;
grant execute on function public.dispatch_gbp_write_grant_v1(uuid, uuid, uuid, uuid, integer) to service_role;
grant execute on function public.finalize_gbp_write_grant_v1(uuid, uuid, uuid, uuid, integer, text, text) to service_role;
grant execute on function public.recover_stale_gbp_dispatched_grants_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz, integer, timestamptz) to service_role;
grant execute on function public.cancel_gbp_claimed_bundle_before_dispatch_v1(uuid, uuid, uuid, text) to service_role;
grant execute on function public.expire_gbp_write_grants_v1(integer) to service_role;
grant execute on function public.transition_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, uuid) to service_role;
grant execute on function public.transition_gbp_connection_provider_failure_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) to service_role;
grant execute on function public.set_gbp_write_access_v1(uuid, uuid, text, text, text, bigint, bigint, boolean, uuid) to service_role;
grant execute on function public.rebind_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, text, text, uuid) to service_role;
grant execute on function public.record_gbp_provider_observation_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid, text, text, timestamptz, timestamptz) to service_role;
grant execute on function public.claim_gbp_core_changes_v2(text, integer, integer) to service_role;
grant execute on function public.complete_gbp_core_change_v2(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.get_gbp_core_outbox_census_v1(uuid) to service_role;
grant execute on function public.repair_gbp_core_change_v1(uuid, uuid, text, uuid, boolean, boolean, text, uuid, text, text[], text, text) to service_role;
grant execute on function public.get_gbp_content_retention_readiness_v1(timestamptz) to service_role;
grant execute on function public.record_gbp_content_observation_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid, text[], text[], timestamptz) to service_role;
grant execute on function public.inherit_gbp_content_lineage_v1(uuid, uuid, bigint, bigint, uuid, text, uuid, text) to service_role;
grant execute on function public.run_gbp_content_retention_v1(timestamptz, integer, integer, boolean, uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.purge_gbp_profile_content_v1(uuid, uuid, text, text, text, bigint, bigint) to service_role;
grant execute on function public.persist_gbp_external_profile_snapshot_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, jsonb, text, timestamptz) to service_role;
grant execute on function public.get_current_gbp_external_profile_snapshots_v1(uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) to service_role;
grant execute on function public.persist_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, jsonb, timestamptz) to service_role;
grant execute on function public.begin_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, timestamptz) to service_role;
grant execute on function public.fail_gbp_dual_sync_snapshot_run_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, timestamptz) to service_role;
grant execute on function public.get_current_gbp_dual_sync_snapshot_runs_v1(uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) to service_role;
grant execute on function public.persist_gbp_food_menu_snapshot_v1(uuid, uuid, text, text, text, bigint, bigint, uuid, text, text, jsonb, text, timestamptz) to service_role;
grant execute on function public.get_current_gbp_food_menu_snapshots_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz) to service_role;
grant execute on function public.apply_gbp_profile_import_to_core_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) to service_role;
grant execute on function public.create_gbp_oauth_attempt_v1(uuid, uuid, text, text, text, timestamptz, uuid, text, text, text, bigint, bigint) to service_role;
grant execute on function public.consume_gbp_oauth_attempt_v1(uuid, text, text, uuid, text, text, text, bigint, bigint) to service_role;
grant execute on function public.complete_gbp_oauth_identity_v1(uuid, text, text, uuid, uuid, text, text, text, text, text[], text, timestamptz, timestamptz) to service_role;
grant execute on function public.refresh_gbp_credential_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, text[], text, timestamptz) to service_role;
grant execute on function public.disconnect_gbp_connection_v1(uuid, uuid, text, text, text, bigint, bigint, text, uuid) to service_role;
grant execute on function public.link_gbp_notification_participation_v1(uuid, uuid, text, text, text, bigint, bigint, text, text) to service_role;
grant execute on function public.unlink_gbp_notification_participation_v1(uuid, uuid, text, text, text, bigint, bigint) to service_role;
grant execute on function public.record_gbp_pubsub_and_enqueue_v1(text, text, text, text, text, text, uuid, uuid, uuid, text, text, text, bigint, bigint, text, timestamptz) to service_role;
grant execute on function public.enqueue_gbp_scheduled_refreshes_v1(timestamptz, timestamptz, integer) to service_role;
grant execute on function public.upsert_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, text, text[], text[], text, text, uuid, timestamptz, timestamptz) to service_role;
grant execute on function public.read_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, timestamptz) to service_role;
grant execute on function public.terminalize_gbp_pending_update_masks_v1(uuid, uuid, text, text, text, bigint, bigint, text, text, timestamptz) to service_role;
grant execute on function public.materialize_gbp_terminal_notice_v1(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.dispatch_gbp_terminal_notice_v1(uuid, uuid, text, uuid, text, timestamptz) to service_role;
grant execute on function public.recover_stale_gbp_dispatched_notices_v1(integer, timestamptz) to service_role;
grant execute on function public.claim_gbp_terminal_notices_v1(text, integer, integer, timestamptz) to service_role;
grant execute on function public.finalize_gbp_terminal_notice_v1(uuid, uuid, text, uuid, text, text, timestamptz) to service_role;
grant execute on function public.get_gbp_terminal_notice_census_v1(uuid, timestamptz) to service_role;
grant execute on function public.reconcile_missing_gbp_terminal_notices_v1(integer, timestamptz) to service_role;
grant execute on function public.array_sort_unique_text(text[]) to service_role;
grant execute on function public.all_sha256_text(text[]) to service_role;
revoke all on type public.gbp_write_grant_issue_v1, public.gbp_write_bundle_enqueue_result_v1, public.gbp_core_outbox_census_v1, public.gbp_content_retention_result_v1, public.gbp_content_retention_readiness_v1, public.gbp_pubsub_receipt_result_v1, public.gbp_scheduled_refresh_result_v1, public.gbp_terminal_notice_census_v1 from public;
grant usage on type public.gbp_write_grant_issue_v1, public.gbp_write_bundle_enqueue_result_v1, public.gbp_core_outbox_census_v1, public.gbp_content_retention_result_v1, public.gbp_content_retention_readiness_v1, public.gbp_pubsub_receipt_result_v1, public.gbp_scheduled_refresh_result_v1, public.gbp_terminal_notice_census_v1 to service_role;

commit;
