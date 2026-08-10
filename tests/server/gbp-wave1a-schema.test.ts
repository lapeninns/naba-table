import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../types/supabase';

const coreProvenanceInsert = {
  field_key: 'title',
  restaurant_id: 'restaurant-id',
  source: 'core',
  source_row_id: 'row-id',
  source_table: 'restaurant_business_details',
  value_hash: 'a'.repeat(64),
} satisfies Database['public']['Tables']['gbp_field_provenance_v1']['Insert'];

const operatorReadinessInsert = {
  backup_restore_verified_at: '2026-08-09T00:00:00Z',
  backup_window_days: 1,
  issued_by_user_id: 'operator-id',
  live_content_ttl_days: 28,
  pitr_verified_at: '2026-08-09T00:00:00Z',
  policy_approved_at: '2026-08-09T00:00:00Z',
  policy_version: 'policy-v1',
  renderer_version: 'renderer-v1',
  transformed_content_approved_at: '2026-08-09T00:00:00Z',
  valid_until: '2026-08-10T00:00:00Z',
} satisfies Database['public']['Tables']['gbp_write_readiness_evidence_v1']['Insert'];

const oauthAttemptCreateArgs = {
  p_connection_generation: 1,
  p_consent_epoch: 1,
  p_expected_external_account_id: null,
  p_expected_external_location_id: null,
  p_expected_external_profile_id: null,
  p_external_profile_row_id: null,
  p_expires_at: '2026-08-09T00:10:00Z',
  p_nonce_hash: 'a'.repeat(64),
  p_requested_by_user_id: 'user-id',
  p_restaurant_id: 'restaurant-id',
  p_return_path: '/settings/restaurant/google-business-profile',
  p_state_hash: 'b'.repeat(64),
} satisfies Database['public']['Functions']['create_gbp_oauth_attempt_v1']['Args'];

const oauthIdentityCompletionArgs = {
  p_connected_email: 'owner@example.com',
  p_connected_name: 'Owner',
  p_granted_scopes: ['scope-1'],
  p_identity_verified_at: '2026-08-09T00:00:00Z',
  p_nonce_hash: 'a'.repeat(64),
  p_provider_user_id: 'google-subject',
  p_refreshed_at: '2026-08-09T00:00:00Z',
  p_refresh_token_encrypted: 'gbp.1.legacy.iv.ciphertext.tag',
  p_requested_by_user_id: 'user-id',
  p_restaurant_id: 'restaurant-id',
  p_state_hash: 'b'.repeat(64),
  p_target_external_profile_row_id: 'profile-row-id',
  p_token_type: 'Bearer',
} satisfies Database['public']['Functions']['complete_gbp_oauth_identity_v1']['Args'];

const providerFailureTransitionArgs = {
  p_connection_generation: 1,
  p_consent_epoch: 1,
  p_expected_account_id: 'account-id',
  p_expected_location_id: 'location-id',
  p_expected_profile_id: 'profile-id',
  p_external_profile_row_id: 'profile-row-id',
  p_next_state: 'reauth_required',
  p_reason_code: 'provider_invalid_grant',
  p_restaurant_id: 'restaurant-id',
} satisfies Database['public']['Functions']['transition_gbp_connection_provider_failure_v1']['Args'];

const wave2IssueArgs = {
  p_actor_user_id: 'actor-id',
  p_bundle_hash: 'a'.repeat(64),
  p_bundle_id: 'bundle-id',
  p_connection_generation: 1,
  p_consent_epoch: 1,
  p_expires_at: '2026-08-09T00:10:00Z',
  p_external_account_id: 'account-id',
  p_external_location_id: 'location-id',
  p_external_profile_id: 'profile-id',
  p_external_profile_row_id: 'profile-row-id',
  p_grants: [
    {
      after_hashes: ['b'.repeat(64)],
      before_hashes: ['c'.repeat(64)],
      bundle_order: 1,
      core_snapshot_hash: 'd'.repeat(64),
      decision_hash: 'e'.repeat(64),
      direction: 'export_to_google',
      field_keys: ['title'],
      google_method: 'PATCH',
      google_resource: 'locations/location-id',
      google_snapshot_hash: 'f'.repeat(64),
      grant_id: 'grant-id',
      group_id: 'business-info-1',
      manifest_hash: '1'.repeat(64),
      preview_fingerprint: '2'.repeat(64),
      request_hash: '3'.repeat(64),
      risk_acknowledgements: ['external_write', 'outcome_may_be_unknown', 'partial_bundle_failure'],
      update_masks: ['title'],
      update_masks_hash: '4'.repeat(64),
      write_group: 'business_info',
    },
  ],
  p_issued_at: '2026-08-09T00:00:00Z',
  p_policy_version: 'policy-v1',
  p_renderer_version: 'renderer-v1',
  p_restaurant_id: 'restaurant-id',
} satisfies Database['public']['Functions']['issue_gbp_write_bundle_v1']['Args'];

const staleDispatchRecoveryArgs = {
  p_connection_generation: 1,
  p_consent_epoch: 1,
  p_cutoff: '2026-08-09T00:00:00Z',
  p_external_account_id: 'account-id',
  p_external_location_id: 'location-id',
  p_external_profile_id: 'profile-id',
  p_external_profile_row_id: 'profile-row-id',
  p_limit: 100,
  p_now: '2026-08-09T00:05:00Z',
  p_restaurant_id: 'restaurant-id',
} satisfies Database['public']['Functions']['recover_stale_gbp_dispatched_grants_v1']['Args'];

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260809120000_gbp_write_safety_foundation.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const compact = migration.replace(/\s+/g, ' ').toLowerCase();
const generatedTypes = readFileSync(join(process.cwd(), 'types/supabase.ts'), 'utf8');

describe('GBP Wave 1A write-safety schema', () => {
  it('defines tenant-fenced connection state and lifecycle fencing', () => {
    expect(compact).toContain(
      "write_state in ('blocked', 'eligible', 'revoking', 'disconnected', 'reauth_required')",
    );
    expect(compact).toContain('alter column consent_epoch set default 1');
    expect(compact).toContain('check (consent_epoch > 0)');
    expect(compact).toContain('alter column connection_generation set default 1');
    expect(compact).toContain('check (connection_generation > 0)');
    expect(compact).toContain('create or replace function public.transition_gbp_connection_v1');
    expect(compact).toContain('consent_epoch = consent_epoch + 1');
    expect(compact).toContain('external_account_id is not distinct from p_expected_account_id');
    expect(compact).toContain('external_location_id is not distinct from p_expected_location_id');
    expect(compact).toContain('actor is required for admin connection transition');
    expect(compact).toContain(
      'create or replace function public.transition_gbp_connection_provider_failure_v1',
    );
    expect(compact).toContain(
      "p_reason_code in ('provider_unauthorized_401', 'provider_invalid_grant')",
    );
    expect(compact).toContain(
      "p_next_state = 'blocked' and p_reason_code = 'provider_access_lost_403'",
    );
    expect(compact).toContain('write_state_actor_user_id = null');
    expect(compact).toContain(
      'revoke all on function public.transition_gbp_connection_provider_failure_v1',
    );
    expect(compact).toContain(
      'grant execute on function public.transition_gbp_connection_provider_failure_v1',
    );
    expect(providerFailureTransitionArgs.p_reason_code).toBe('provider_invalid_grant');
  });

  it('stores exact short-lived hash-only grants and immutable consent events', () => {
    expect(compact).toContain('create table public.gbp_write_grants_v1');
    expect(compact).toContain(
      "status in ('granted', 'claimed', 'dispatched', 'consumed', 'failed', 'outcome_unknown', 'expired', 'revoked', 'cancelled_before_dispatch', 'cancelled_after_bundle_failure')",
    );
    expect(compact).toContain("expires_at <= issued_at + interval '15 minutes'");
    expect(compact).toContain('before_hashes text[] not null');
    expect(compact).toContain('after_hashes text[] not null');
    expect(compact).toContain('create table public.gbp_consent_events_v1');
    expect(compact).toContain('create trigger gbp_consent_events_v1_immutable');
    expect(compact).toContain('create trigger gbp_write_grants_v1_transition_guard');
    expect(compact).toContain("old.status = 'dispatched'");
    expect(compact).not.toMatch(
      /gbp_write_grants_v1[\s\S]{0,1800}(raw_value|request_body|response_body|provider_content)/,
    );
  });

  it('claims complete bundles atomically with deterministic locks and rollout enforcement', () => {
    expect(compact).toContain('create or replace function public.claim_gbp_write_bundle_v1');
    expect(compact).toContain('for update; -- connection lock first');
    expect(compact).toContain('order by g.bundle_order, g.id for update');
    expect(compact).toContain('cardinality(p_grant_ids)');
    expect(compact).toContain('array_agg(g.manifest_hash order by g.bundle_order)');
    expect(compact).toContain('array_agg(g.request_hash order by g.bundle_order)');
    expect(compact).toContain('array_agg(g.decision_hash order by g.bundle_order)');
    expect(compact).toContain('array_agg(g.update_masks_hash order by g.bundle_order)');
    expect(compact).toContain('public.gbp_write_rollout_config_v1');
    expect(compact).toContain('public.gbp_write_canary_restaurants_v1');
    expect(compact).toContain('public.gbp_write_allowlist_v1');
    expect(compact).toContain("rollout_mode in ('off', 'canary', 'allowlist', 'on')");
    expect(compact).toContain("raise exception using errcode = '42501'");
  });

  it('persists dispatch before terminal outcomes and never reuses dispatched grants', () => {
    expect(compact).toContain('create or replace function public.dispatch_gbp_write_bundle_v1');
    expect(compact).toContain("and status = 'claimed'");
    expect(compact).toContain("set status = 'dispatched'");
    expect(compact).toContain('create or replace function public.finalize_gbp_write_bundle_v1');
    expect(compact).toContain(
      "p_status in ('consumed', 'failed', 'outcome_unknown', 'cancelled_after_bundle_failure')",
    );
    expect(compact).toContain("v_required_status := 'dispatched'");
  });

  it('issues and enqueues exact bundles atomically through RPC-only grant writes', () => {
    expect(compact).toContain('create type public.gbp_write_grant_issue_v1 as');
    expect(compact).toContain('create or replace function public.issue_gbp_write_bundle_v1');
    expect(compact).toContain(
      'create or replace function public.issue_and_enqueue_gbp_write_bundle_v1',
    );
    expect(compact).toContain(
      'create or replace function public.issue_and_claim_gbp_write_bundle_v1',
    );
    expect(compact).toContain("message = 'gbp sync is paused'");
    expect(compact).toContain("jsonb_build_object('bundle_id', p_bundle_id");
    expect(compact).toContain("'grant_ids', v_grant_ids");
    expect(compact).toContain("'manifest_hashes', v_manifest_hashes");
    expect(compact).toContain("'confirmation_version', 'gbp-exact-consent-v1'");
    expect(compact).toContain("'groups', v_groups");
    expect(compact).toContain(
      "'accounts/' || external_account_id || '/locations/' || external_location_id || '/foodmenus'",
    );
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.gbp_write_grants_v1',
    );
    expect(compact).toContain('grant select on public.gbp_write_grants_v1 to service_role');
    expect(compact).toContain('count(*) filter (where value is null) = 0');
    expect(compact).toContain("bool_and(value ~ '^[a-f0-9]{64}$') is true");
    expect(compact).toContain('array_position(field_keys, null) is null');
    expect(compact).toContain('array_position(update_masks, null) is null');
    expect(compact).toContain('array_position(before_hashes, null) is null');
    expect(compact).toContain('array_position(after_hashes, null) is null');
    expect(compact).toContain('array_position(risk_acknowledgements, null) is null');
    expect(compact).toContain('v_item.grant_id is null');
    expect(compact).toContain('v_item.manifest_hash is null');
    expect(wave2IssueArgs.p_grants[0].group_id).toBe('business-info-1');
  });

  it('accepts only canonical location and FoodMenus resources', () => {
    expect(compact).toContain("v_item.google_resource = 'locations/' || p_external_location_id");
    expect(compact).toContain("google_resource = 'locations/' || external_location_id");
    expect(compact).not.toContain(
      "v_item.google_resource like 'locations/%/' || p_external_location_id",
    );
  });

  it('dispatches and finalizes grants in strict bundle order', () => {
    expect(compact).toContain('create or replace function public.dispatch_gbp_write_grant_v1');
    expect(compact).toContain('create or replace function public.finalize_gbp_write_grant_v1');
    expect(compact).toContain(
      'create or replace function public.cancel_gbp_claimed_bundle_before_dispatch_v1',
    );
    expect(compact).toContain('prior gbp grant is not consumed');
    expect(compact).toContain("status = 'cancelled_after_bundle_failure'");
    expect(compact).toContain('dispatched gbp grant prevents bundle cancellation');
  });

  it('recovers stale dispatched grants without permitting provider re-emission', () => {
    expect(compact).toContain(
      'create or replace function public.recover_stale_gbp_dispatched_grants_v1',
    );
    expect(compact).toContain("reason_code = 'terminal_persistence_unknown'");
    expect(compact).toContain('for update skip locked');
    expect(compact).toContain('p_limit > 500');
    expect(compact).toContain(
      'revoke all on function public.recover_stale_gbp_dispatched_grants_v1',
    );
    expect(compact).toContain(
      'grant execute on function public.recover_stale_gbp_dispatched_grants_v1',
    );
    expect(generatedTypes).toContain('recover_stale_gbp_dispatched_grants_v1: {');
    expect(staleDispatchRecoveryArgs.p_limit).toBe(100);
  });

  it('makes mutation jobs single-attempt and immutable without affecting refresh jobs', () => {
    expect(compact).toContain('dual_sync_jobs_gbp_mutation_once_v1_check');
    expect(compact).toContain('guard_gbp_mutation_job_v1');
    expect(compact).toContain("new.status = 'retrying'");
    expect(compact).toContain("old.status in ('succeeded', 'failed', 'dead_letter', 'cancelled')");
    expect(compact).toContain("job_kind in ('publish_batch', 'auto_export')");
  });

  it('supports account-shared notifications without clobbering unrelated event types', () => {
    expect(compact).toContain('create table public.gbp_notification_registries_v1');
    expect(compact).toContain('create table public.gbp_notification_event_types_v1');
    expect(compact).toContain('create table public.gbp_notification_restaurant_links_v1');
    expect(compact).toContain('unique (provider, external_account_id, managed_topic)');
    expect(compact).toContain('unique (registry_id, event_type)');
    expect(compact).toContain('create table public.gbp_pubsub_receipts_v1');
    expect(compact).toContain('primary key (subscription, message_id)');
    expect(compact).toContain('gbp_notification_links_v1_registry_account_fkey');
    expect(compact).toContain('refresh_gbp_notification_ref_count_v1');
    expect(compact).toContain('gbp_notification_links_v1_connection_fence_fkey');
    expect(compact).toContain(
      'foreign key (restaurant_id, external_profile_row_id, external_account_id, external_profile_id, external_location_id, connection_generation, consent_epoch)',
    );
  });

  it('dedupes push receipts and drives fenced refresh and terminal-notice work through RPCs', () => {
    expect(compact).toContain('create type public.gbp_pubsub_receipt_result_v1');
    expect(compact).toContain('create or replace function public.record_gbp_pubsub_and_enqueue_v1');
    expect(compact).toContain(
      'create or replace function public.enqueue_gbp_scheduled_refreshes_v1',
    );
    expect(compact).toContain('create table public.gbp_pending_update_masks_v1');
    expect(compact).toContain(
      'create or replace function public.upsert_gbp_pending_update_masks_v1',
    );
    expect(compact).toContain('create or replace function public.read_gbp_pending_update_masks_v1');
    expect(compact).toContain(
      'create or replace function public.terminalize_gbp_pending_update_masks_v1',
    );
    expect(compact).toContain('create table public.gbp_terminal_outcome_notices_v1');
    expect(compact).toContain('create table public.gbp_terminal_notice_delivery_attempts_v1');
    expect(compact).toContain(
      'create or replace function public.materialize_gbp_terminal_notice_v1',
    );
    expect(compact).toContain('create or replace function public.claim_gbp_terminal_notices_v1');
    expect(compact).toContain('create or replace function public.finalize_gbp_terminal_notice_v1');
    expect(compact).toContain('create or replace function public.dispatch_gbp_terminal_notice_v1');
    expect(compact).toContain(
      'create or replace function public.recover_stale_gbp_dispatched_notices_v1',
    );
    expect(compact).toContain(
      "status in ('pending','claimed','dispatched','delivered','failed','outcome_unknown')",
    );
    expect(compact).toContain(
      'create or replace function public.get_gbp_terminal_notice_census_v1',
    );
    expect(compact).toContain(
      'create or replace function public.reconcile_missing_gbp_terminal_notices_v1',
    );
    expect(compact).toContain('left join public.gbp_terminal_outcome_notices_v1 n');
    expect(compact).toContain('and n.id is null');
    expect(compact).toContain("interval '48 hours'");
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.gbp_pubsub_receipts_v1',
    );
  });

  it('constrains provider expiry and policy approval while decommissioning content archives', () => {
    expect(compact).toContain('create table public.gbp_field_provenance_v1');
    expect(compact).toContain("source in ('core', 'google', 'mixed')");
    expect(compact).toContain("expires_at <= observed_at + interval '30 days'");
    expect(compact).toContain("expiry_basis = 'fresh_provider_fetch'");
    expect(compact).toContain('gbp_field_provenance_v1_connection_guard');
    expect(compact).toContain('external_profile_row_id uuid');
    expect(compact).toContain('external_account_id text');
    expect(compact).toContain('create table public.gbp_write_policy_config_v1');
    expect(compact).toContain('backup_window_days between 1 and 28');
    expect(compact).toContain('create table public.gbp_write_readiness_evidence_v1');
    expect(compact).toContain('backup_restore_verified_at timestamptz not null');
    expect(compact).toContain('pitr_verified_at timestamptz not null');
    expect(compact).toContain('transformed_content_approved_at timestamptz not null');
    expect(compact).toContain("message = 'gbp write readiness is not proven'");
    expect(compact).toContain('create or replace function public.set_gbp_readiness_hash_v1');
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.gbp_write_readiness_evidence_v1 from service_role',
    );
    expect(compact).not.toContain(
      'grant select, insert on public.gbp_write_readiness_evidence_v1 to service_role',
    );
    expect(compact).toContain('content_archive_decommissioned_at');
  });

  it('runs bounded metadata-only Google content retention from exact lineage', () => {
    expect(compact).toContain('create table public.gbp_content_lineage_v1');
    expect(compact).toContain("expires_at <= observed_at + interval '30 days'");
    expect(compact).toContain(
      'create or replace function public.record_gbp_content_observation_v1',
    );
    expect(compact).toContain('create or replace function public.inherit_gbp_content_lineage_v1');
    expect(compact).toContain('create or replace function public.run_gbp_content_retention_v1');
    expect(compact).toContain(
      'create or replace function public.get_gbp_content_retention_readiness_v1',
    );
    expect(compact).toContain('create or replace function public.purge_gbp_profile_content_v1');
    expect(compact).toContain('for update skip locked');
    expect(compact).toContain('dual_sync_google_request_log_archives');
    expect(compact).toContain('restaurant_gbp_food_menu_snapshots');
    expect(compact).toContain('restaurant_external_profile_snapshots');
    expect(compact).toContain('alter column retention_expires_at drop default');
    expect(compact).toContain('alter column retention_expires_at drop not null');
    expect(compact).toContain('dual_sync_google_request_logs_metadata_only_v1_check');
    expect(compact).toContain(
      'create or replace function public.persist_gbp_dual_sync_snapshot_run_v1',
    );
    expect(compact).toContain(
      'create or replace function public.begin_gbp_dual_sync_snapshot_run_v1',
    );
    expect(compact).toContain(
      'create or replace function public.fail_gbp_dual_sync_snapshot_run_v1',
    );
    expect(compact).toContain("and status = 'pending' and raw_payload is null");
    expect(compact).toContain('and (p_run_kind is null or s.run_kind = p_run_kind)');
    expect(compact).toContain("l.content_field = 'bool_value'");
    expect(compact).toContain('get diagnostics v_step = row_count');
    expect(compact).not.toContain('execute format(');
  });

  it('creates a hash-only trigger outbox for every canonical GBP table', () => {
    expect(compact).toContain('create table public.gbp_core_change_outbox_v1');
    expect(compact).toContain('create or replace function public.enqueue_gbp_core_change_v1');
    expect(compact).toContain('for update skip locked');
    for (const table of [
      'restaurant_business_details',
      'restaurant_addresses',
      'restaurant_phone_numbers',
      'restaurant_links',
      'restaurant_categories',
      'restaurant_service_areas',
      'restaurant_hours',
      'restaurant_attributes',
      'restaurant_service_items',
      'restaurants',
      'restaurant_operating_hours',
      'restaurant_service_periods',
    ]) {
      expect(compact).toContain(`create trigger ${table}_gbp_core_outbox`);
    }
    expect(compact).not.toMatch(
      /create table public\.gbp_core_change_outbox_v1[\s\S]{0,1600}(old_value|new_value|payload jsonb)/,
    );
    expect(compact).toContain(
      'create or replace function public.enqueue_gbp_restaurants_change_v1',
    );
    expect(compact).toContain(
      "array['address', 'contact_phone', 'google_map_url', 'google_review_url', 'name']",
    );
    expect(compact).toContain(
      'create or replace function public.enqueue_gbp_operating_hours_change_v1',
    );
    expect(compact).toContain("'weekly_' || day_value::text");
    expect(compact).toContain(
      'create or replace function public.enqueue_gbp_service_period_change_v1',
    );
    expect(compact).toContain("array['service_periods']::text[]");
    expect(compact).toContain(
      'create or replace function public.apply_gbp_profile_import_to_core_v1',
    );
    expect(compact).toContain("current_setting('app.gbp_provider_import_fence', true)");
    expect(compact).toContain('revoke all on function public.apply_gbp_profile_import_to_core_v1');
  });

  it('leases Core outbox work with bounded retry, dead-letter, census, and repair RPCs', () => {
    expect(compact).toContain('attempt_count integer not null default 0');
    expect(compact).toContain('max_attempts integer not null default 5');
    expect(compact).toContain('lease_expires_at timestamptz');
    expect(compact).toContain('lease_token uuid');
    expect(compact).toContain("status in ('pending', 'claimed', 'completed', 'dead_letter')");
    expect(compact).toContain('array_position(field_keys, null) is null');
    expect(compact).toContain('create or replace function public.claim_gbp_core_changes_v2');
    expect(compact).toContain('for update skip locked');
    expect(compact).toContain('create or replace function public.complete_gbp_core_change_v2');
    expect(compact).toContain('create or replace function public.get_gbp_core_outbox_census_v1');
    expect(compact).toContain('create or replace function public.repair_gbp_core_change_v1');
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.gbp_core_change_outbox_v1',
    );
  });

  it('hardens every new table and RPC to service role only', () => {
    expect(compact).toContain('alter table public.gbp_write_grants_v1 enable row level security');
    expect(compact).toContain('create policy gbp_write_grants_v1_service_role');
    expect(compact).toMatch(
      /revoke all on [^;]*public\.gbp_write_grants_v1[^;]* from public, anon, authenticated/,
    );
    expect(compact).toContain('grant select on public.gbp_write_grants_v1 to service_role');
    expect(compact).toContain('security definer set search_path = public');
    expect(compact).toContain('revoke all on function public.claim_gbp_write_bundle_v1');
    expect(compact).toContain('grant execute on function public.claim_gbp_write_bundle_v1');
    expect(compact).not.toContain('execute format');
  });

  it('uses composite tenant fences and one-attempt publish jobs', () => {
    expect(compact).toContain('gbp_write_grants_v1_profile_tenant_fkey');
    expect(compact).toContain('foreign key (restaurant_id, external_profile_row_id)');
    expect(compact).toContain('gbp_consent_events_v1_grant_tenant_fkey');
    expect(compact).toContain(
      "write_bundle_id is null or (job_kind = 'publish_batch' and max_attempts = 1",
    );
    expect(compact).toContain('create or replace function public.rebind_gbp_connection_v1');
    expect(compact).toContain('connection_generation = connection_generation + 1');
    expect(compact).toContain("last_error_code = 'legacy_unfenced_write_job'");
    expect(compact).toContain("job_kind in ('publish_batch', 'auto_export')");
    expect(compact).toContain('consent_epoch is null or consent_epoch <= p_consent_epoch');
    expect(compact).toContain('restaurant_id = p_restaurant_id and provider =');
  });

  it('stores and consumes hash-only OAuth attempts with current connection fencing', () => {
    expect(compact).toContain('alter table public.restaurant_external_profile_oauth_states');
    expect(compact).toContain('oidc_nonce_hash text');
    expect(compact).toContain('state_hash text');
    expect(compact).toContain('connection_generation bigint');
    expect(compact).toContain('consent_epoch bigint');
    expect(compact).toContain('create or replace function public.create_gbp_oauth_attempt_v1');
    expect(compact).toContain('create or replace function public.consume_gbp_oauth_attempt_v1');
    expect(compact).toContain('for update; -- restaurant lock first');
    expect(compact).toContain('for update; -- oauth attempt lock last');
    expect(compact).toContain("invalidation_reason = 'superseded'");
    expect(compact).toContain("invalidation_reason = 'legacy_unfenced'");
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.restaurant_external_profile_oauth_states from service_role',
    );
    expect(compact).toContain('grant execute on function public.consume_gbp_oauth_attempt_v1');
    expect(compact).not.toContain('p_nonce text');
  });

  it('atomically completes OAuth identity, profile, and encrypted credential persistence', () => {
    expect(compact).toContain('create or replace function public.complete_gbp_oauth_identity_v1');
    expect(compact).toContain('p_target_external_profile_row_id uuid');
    expect(compact).toContain("p_refresh_token_encrypted !~ '^gbp\\.1\\.");
    expect(compact).toContain('for update; -- completion restaurant lock first');
    expect(compact).toContain('for update; -- completion profile lock second');
    expect(compact).toContain('for update; -- completion attempt lock last');
    expect(compact).toContain('insert into public.restaurant_external_profile_credentials');
    expect(compact).toContain('on conflict (external_profile_id) do update');
    expect(compact).toContain(
      'revoke insert, update, delete, truncate on public.restaurant_external_profile_credentials from service_role',
    );
    expect(compact).toContain('grant execute on function public.complete_gbp_oauth_identity_v1');
    expect(oauthIdentityCompletionArgs.p_target_external_profile_row_id).toBe('profile-row-id');
    expect(compact).toContain('create or replace function public.disconnect_gbp_connection_v1');
    expect(compact).toContain('connection_generation = p_connection_generation');
    expect(compact).toContain('consent_epoch = p_consent_epoch');
    expect(compact).toContain('grant execute on function public.disconnect_gbp_connection_v1');
  });

  it('sets owner write access only through an exact-fenced readiness-gated RPC', () => {
    expect(compact).toContain('create or replace function public.set_gbp_write_access_v1');
    expect(compact).toContain("write_state_reason_code = 'owner_enabled'");
    expect(compact).toContain("write_state_reason_code = 'owner_disabled'");
    expect(compact).toContain("job_kind in ('publish_batch','auto_export')");
    expect(generatedTypes).toContain('set_gbp_write_access_v1: {');
  });

  it('publishes generated table, altered-column, relationship, and RPC contracts', () => {
    for (const table of [
      'dual_sync_jobs',
      'gbp_consent_events_v1',
      'gbp_core_change_outbox_v1',
      'gbp_field_provenance_v1',
      'gbp_notification_event_types_v1',
      'gbp_notification_registries_v1',
      'gbp_notification_restaurant_links_v1',
      'gbp_pending_update_masks_v1',
      'gbp_pubsub_receipts_v1',
      'gbp_terminal_outcome_notices_v1',
      'gbp_terminal_notice_delivery_attempts_v1',
      'gbp_write_allowlist_v1',
      'gbp_write_canary_restaurants_v1',
      'gbp_write_grants_v1',
      'gbp_write_policy_config_v1',
      'gbp_write_readiness_evidence_v1',
      'gbp_write_rollout_config_v1',
      'restaurant_external_profile_oauth_states',
    ]) {
      expect(generatedTypes).toContain(`${table}: {`);
    }
    expect(generatedTypes).toContain('write_state_changed_at: string;');
    expect(generatedTypes).toContain('claim_gbp_write_bundle_v1: {');
    expect(generatedTypes).toContain('issue_gbp_write_bundle_v1: {');
    expect(generatedTypes).toContain('issue_and_enqueue_gbp_write_bundle_v1: {');
    expect(generatedTypes).toContain('issue_and_claim_gbp_write_bundle_v1: {');
    expect(generatedTypes).toContain('dispatch_gbp_write_grant_v1: {');
    expect(generatedTypes).toContain('finalize_gbp_write_grant_v1: {');
    expect(generatedTypes).toContain('claim_gbp_core_changes_v2: {');
    expect(generatedTypes).toContain('complete_gbp_core_change_v2: {');
    expect(generatedTypes).toContain('get_gbp_core_outbox_census_v1: {');
    expect(generatedTypes).toContain('repair_gbp_core_change_v1: {');
    expect(generatedTypes).toContain('record_gbp_pubsub_and_enqueue_v1: {');
    expect(generatedTypes).toContain('enqueue_gbp_scheduled_refreshes_v1: {');
    expect(generatedTypes).toContain('upsert_gbp_pending_update_masks_v1: {');
    expect(generatedTypes).toContain('materialize_gbp_terminal_notice_v1: {');
    expect(generatedTypes).toContain('claim_gbp_terminal_notices_v1: {');
    expect(generatedTypes).toContain('finalize_gbp_terminal_notice_v1: {');
    expect(generatedTypes).toContain('dispatch_gbp_terminal_notice_v1: {');
    expect(generatedTypes).toContain('recover_stale_gbp_dispatched_notices_v1: {');
    expect(generatedTypes).toContain('get_gbp_terminal_notice_census_v1: {');
    expect(generatedTypes).toContain('reconcile_missing_gbp_terminal_notices_v1: {');
    expect(generatedTypes).toContain('gbp_core_outbox_census_v1: GbpCoreOutboxCensusV1;');
    expect(generatedTypes).toContain('gbp_write_grant_issue_v1: GbpWriteGrantIssueV1;');
    expect(generatedTypes).toContain('record_gbp_provider_observation_v1: {');
    expect(generatedTypes).toContain("foreignKeyName: 'gbp_write_grants_v1_profile_tenant_fkey'");
    expect(coreProvenanceInsert.source).toBe('core');
    expect(operatorReadinessInsert.policy_version).toBe('policy-v1');
    expect(oauthAttemptCreateArgs.p_external_profile_row_id).toBeNull();
  });
});
