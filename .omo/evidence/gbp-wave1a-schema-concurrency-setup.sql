\set ON_ERROR_STOP on
insert into public.gbp_write_grants_v1 (
  id, restaurant_id, external_profile_row_id, actor_user_id, provider,
  external_account_id, external_profile_id, external_location_id,
  connection_generation, consent_epoch, direction, field_keys, group_id, write_group,
  google_method, google_resource, update_masks, update_masks_hash,
  before_hashes, after_hashes, request_hash, decision_hash,
  core_snapshot_hash, google_snapshot_hash, preview_fingerprint,
  risk_acknowledgements, policy_version, renderer_version, manifest_hash,
  bundle_id, bundle_order, bundle_size, bundle_hash, issued_at, expires_at
)
select
  '30000000-0000-0000-0000-000000000002', restaurant_id,
  external_profile_row_id, actor_user_id, provider, external_account_id,
  external_profile_id, external_location_id, connection_generation,
  consent_epoch, direction, field_keys, 'concurrency-group', write_group, google_method,
  google_resource, update_masks, update_masks_hash, before_hashes,
  after_hashes, repeat('8', 64), repeat('9', 64), core_snapshot_hash,
  google_snapshot_hash, preview_fingerprint, risk_acknowledgements,
  policy_version, renderer_version, repeat('a', 64),
  '40000000-0000-0000-0000-000000000002', 1, 1, repeat('b', 64),
  timezone('utc', now()), timezone('utc', now()) + interval '10 minutes'
from public.gbp_write_grants_v1
where id = '30000000-0000-0000-0000-000000000001';
