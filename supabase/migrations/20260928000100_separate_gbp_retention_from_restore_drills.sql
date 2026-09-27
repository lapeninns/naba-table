begin;

-- Retention attestation governs provider-content lifetime. A recovery drill is
-- separate operational evidence; NULL means no restore has been verified.
-- Existing attestations and their hashes remain immutable and expire normally.
alter table public.gbp_write_readiness_evidence_v1
  add column backup_retention_verified_at timestamptz,
  alter column backup_restore_verified_at drop not null,
  drop constraint gbp_write_readiness_evidence_v1_proof_times_check;

alter table public.gbp_write_readiness_evidence_v1
  add constraint gbp_write_readiness_evidence_v1_proof_times_check check (
    backup_retention_verified_at is not null
    and backup_retention_verified_at <= issued_at
    and backup_retention_verified_at >= issued_at - interval '30 days'
    and pitr_verified_at <= issued_at
    and pitr_verified_at >= issued_at - interval '30 days'
    and policy_approved_at <= issued_at
    and transformed_content_approved_at <= issued_at
    and (backup_restore_verified_at is null or backup_restore_verified_at <= issued_at)
    and valid_until <= backup_retention_verified_at + interval '30 days'
    and valid_until <= pitr_verified_at + interval '30 days'
  ) not valid;

comment on column public.gbp_write_readiness_evidence_v1.backup_retention_verified_at is
  'Observed verification of all backup retention windows. Required for new attestations; legacy rows retain their original restore-backed proof until expiry.';
comment on column public.gbp_write_readiness_evidence_v1.backup_restore_verified_at is
  'Independent disaster-recovery drill evidence. NULL explicitly means unverified; not a GBP availability prerequisite.';
comment on column public.gbp_write_readiness_evidence_v1.pitr_verified_at is
  'Observed verification of PITR configuration and retention window, including confirmed disabled state; not a restore drill.';

create or replace function public.set_gbp_readiness_hash_v1()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.evidence_hash := encode(digest(jsonb_build_array(
    'retention-attestation-v2',
    new.id::text,
    new.provider,
    new.policy_version,
    new.renderer_version,
    new.backup_window_days,
    new.live_content_ttl_days,
    extract(epoch from new.backup_retention_verified_at),
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

create or replace function public.get_gbp_content_retention_readiness_v1(
  p_now timestamptz default timezone('utc', now())
) returns public.gbp_content_retention_readiness_v1
language plpgsql security definer set search_path = public as $$
declare v_result public.gbp_content_retention_readiness_v1;
begin
  select e.provider, e.policy_version, e.renderer_version, e.backup_window_days,
    least(28, 30 - e.backup_window_days - 1, e.live_content_ttl_days), e.valid_until,
    (e.valid_until > p_now
      and coalesce(e.backup_retention_verified_at, e.backup_restore_verified_at)
        >= e.issued_at - interval '30 days'
      and e.pitr_verified_at >= e.issued_at - interval '30 days'
      and e.policy_approved_at <= e.issued_at
      and e.transformed_content_approved_at <= e.issued_at)
  into v_result from public.gbp_write_readiness_evidence_v1 e
  join public.gbp_write_policy_config_v1 c
    on c.provider = e.provider and c.policy_version = e.policy_version
      and c.renderer_version = e.renderer_version
      and c.backup_window_days = e.backup_window_days
      and c.proven_content_ttl_days = e.live_content_ttl_days
  where e.provider = 'google_business_profile'
    and e.issued_at <= p_now and e.valid_until > p_now
  order by e.issued_at desc limit 1;
  if not found then v_result := row('google_business_profile', null, null, null, null, null, false); end if;
  return v_result;
end;
$$;

-- No policy approval, rollout, consent or evidence is fabricated by this change.
-- The existing append-only trigger and service-role SELECT-only grants remain.
commit;
