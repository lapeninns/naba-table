import { describe, expect, it } from 'vitest';

import type { DualSyncJobRow } from '@/server/dual-sync/db';
import type { DualSyncJob } from '@/server/dual-sync/types';

type DualSyncJobFence = Pick<
  DualSyncJob,
  | 'externalProfileId'
  | 'externalAccountId'
  | 'externalLocationId'
  | 'connectionGeneration'
  | 'consentEpoch'
>;

function mapJobFence(row: DualSyncJobRow): DualSyncJobFence {
  return {
    externalProfileId: row.external_profile_id,
    externalAccountId: row.external_account_id,
    externalLocationId: row.external_location_id,
    connectionGeneration: row.connection_generation,
    consentEpoch: row.consent_epoch,
  };
}

describe('dual-sync job fence type contract', () => {
  it('maps exact external connection metadata without moving content into payload', () => {
    // Given
    const row: DualSyncJobRow = {
      id: 'job-1',
      restaurant_id: 'restaurant-1',
      provider: 'google_business_profile',
      job_kind: 'publish_batch',
      status: 'queued',
      idempotency_key: 'grant-1',
      priority: 100,
      payload: { grantId: 'grant-1' },
      external_profile_id: 'profile-1',
      external_account_id: 'account-1',
      external_location_id: 'location-1',
      connection_generation: 3,
      consent_epoch: 4,
      attempt_count: 0,
      max_attempts: 1,
      available_at: '2026-08-09T12:00:00.000Z',
      locked_at: null,
      locked_by: null,
      last_error_code: null,
      last_error_message: null,
      dead_letter_reason: null,
      started_at: null,
      finished_at: null,
      created_at: '2026-08-09T12:00:00.000Z',
      updated_at: '2026-08-09T12:00:00.000Z',
    };

    // When
    const fence = mapJobFence(row);

    // Then
    expect(fence).toEqual({
      externalProfileId: 'profile-1',
      externalAccountId: 'account-1',
      externalLocationId: 'location-1',
      connectionGeneration: 3,
      consentEpoch: 4,
    });
    expect(row.payload).toEqual({ grantId: 'grant-1' });
  });

  it('preserves null for legacy and non-write jobs without inventing a fence', () => {
    // Given
    const row: DualSyncJobRow = {
      id: 'job-2',
      restaurant_id: 'restaurant-1',
      provider: 'google_business_profile',
      job_kind: 'google_refresh_manual',
      status: 'queued',
      idempotency_key: null,
      priority: 100,
      payload: {},
      external_profile_id: null,
      external_account_id: null,
      external_location_id: null,
      connection_generation: null,
      consent_epoch: null,
      attempt_count: 0,
      max_attempts: 3,
      available_at: '2026-08-09T12:00:00.000Z',
      locked_at: null,
      locked_by: null,
      last_error_code: null,
      last_error_message: null,
      dead_letter_reason: null,
      started_at: null,
      finished_at: null,
      created_at: '2026-08-09T12:00:00.000Z',
      updated_at: '2026-08-09T12:00:00.000Z',
    };

    // When
    const fence = mapJobFence(row);

    // Then
    expect(fence).toEqual({
      externalProfileId: null,
      externalAccountId: null,
      externalLocationId: null,
      connectionGeneration: null,
      consentEpoch: null,
    });
  });
});
