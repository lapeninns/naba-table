\set ON_ERROR_STOP on

update public.restaurant_external_profiles
set write_state = 'eligible', push_enabled = true
where id = '10000000-0000-0000-0000-000000000001';

insert into public.gbp_write_grants_v1 (
  id, restaurant_id, external_profile_row_id, actor_user_id,
  external_account_id, external_profile_id, external_location_id,
  connection_generation, consent_epoch, direction, field_keys, group_id, write_group,
  google_method, google_resource, update_masks, update_masks_hash,
  before_hashes, after_hashes, request_hash, decision_hash,
  core_snapshot_hash, google_snapshot_hash, preview_fingerprint,
  risk_acknowledgements, policy_version, renderer_version, manifest_hash,
  bundle_id, bundle_order, bundle_size, bundle_hash, issued_at, expires_at
) values
(
  '3f000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-new', 'profile-new', 'location-new', 2, 2,
  'export_to_google', array['title'], 'recovery-race-1', 'business_info',
  'PATCH', 'locations/location-new', array['title'], repeat('1', 64),
  array[repeat('2', 64)], array[repeat('3', 64)], repeat('4', 64), repeat('5', 64),
  repeat('6', 64), repeat('7', 64), repeat('8', 64),
  array['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
  'policy-1', 'renderer-1', repeat('9', 64),
  '4f000000-0000-0000-0000-000000000001', 1, 2, repeat('a', 64),
  timezone('utc', now()), timezone('utc', now()) + interval '10 minutes'
),
(
  '3f000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'account-new', 'profile-new', 'location-new', 2, 2,
  'export_to_google', array['title'], 'recovery-race-2', 'business_info',
  'PATCH', 'locations/location-new', array['title'], repeat('1', 64),
  array[repeat('2', 64)], array[repeat('3', 64)], repeat('4', 64), repeat('5', 64),
  repeat('6', 64), repeat('7', 64), repeat('8', 64),
  array['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
  'policy-1', 'renderer-1', repeat('b', 64),
  '4f000000-0000-0000-0000-000000000001', 2, 2, repeat('a', 64),
  timezone('utc', now()), timezone('utc', now()) + interval '10 minutes'
);

update public.gbp_write_grants_v1
set status = 'claimed', execution_id = '5f000000-0000-0000-0000-000000000001',
    claimed_at = timezone('utc', now()) - interval '1 hour'
where bundle_id = '4f000000-0000-0000-0000-000000000001';

update public.gbp_write_grants_v1
set status = 'dispatched', dispatched_at = timezone('utc', now()) - interval '1 hour'
where id = '3f000000-0000-0000-0000-000000000001';
