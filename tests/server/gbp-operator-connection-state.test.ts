import { describe, expect, it, vi } from 'vitest';

import {
  loadGbpOperatorConnectionState,
  setGbpOperatorWriteAccess,
} from '@/server/dual-sync/freshness/operator-connection-state';

import type { GoogleBusinessProfileConnectionState } from '@/server/google-business-profile/serviceConnectionStateTypes';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function query<T>(data: T) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

const connection: GoogleBusinessProfileConnectionState = {
  isConfigured: true,
  provider: 'google_business_profile',
  status: 'linked',
  pushEnabled: false,
  connectedGoogleEmail: null,
  connectedGoogleName: null,
  externalAccountId: 'account-1',
  externalAccountName: null,
  externalLocationId: 'location-1',
  externalLocationName: null,
  externalLocationTitle: null,
  externalPlaceId: null,
  providerTimezone: null,
  lastPullAt: '2026-08-09T09:55:00.000Z',
  lastPushAt: null,
  lastError: null,
  availableLocations: [],
  businessInfo: {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    coreNormalization: {
      operatingHours: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: 'Unavailable',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: 'Unavailable',
        warnings: [],
        periods: [],
      },
      bookingHours: {
        matchStatus: 'unavailable',
        summary: 'Unavailable',
        warnings: [],
        missingInputs: [],
      },
    },
  },
};

describe('GBP operator connection state', () => {
  it('derives the exact current write fence on the server before the atomic transition', async () => {
    const profile = {
      id: 'profile-row-1',
      restaurant_id: 'rest-1',
      external_account_id: 'account-1',
      external_profile_id: 'profile-1',
      external_location_id: 'location-1',
      connection_generation: 7,
      consent_epoch: 11,
      write_state: 'blocked',
      write_state_reason_code: 'owner_disabled',
      last_pull_at: null,
      last_error: null,
      updated_at: '2026-08-09T09:55:00.000Z',
    };
    const rpc = vi.fn(async () => ({ data: profile, error: null }));
    const client = {
      from: vi.fn(() => query(profile)),
      rpc,
    } as unknown as SupabaseClient<Database>;

    await setGbpOperatorWriteAccess({
      client,
      restaurantId: 'rest-1',
      actorUserId: 'user-1',
      enabled: true,
    });

    expect(rpc).toHaveBeenCalledWith('set_gbp_write_access_v1', {
      p_restaurant_id: 'rest-1',
      p_external_profile_row_id: 'profile-row-1',
      p_external_account_id: 'account-1',
      p_external_profile_id: 'profile-1',
      p_external_location_id: 'location-1',
      p_connection_generation: 7,
      p_consent_epoch: 11,
      p_enabled: true,
      p_actor_user_id: 'user-1',
    });
  });

  it('embeds exact current pending masks and account notification participation', async () => {
    const profile = {
      id: 'profile-row-1',
      restaurant_id: 'rest-1',
      external_account_id: 'account-1',
      external_profile_id: 'profile-1',
      external_location_id: 'location-1',
      connection_generation: 2,
      consent_epoch: 3,
      write_state: 'eligible',
      write_state_reason_code: 'operator_enabled',
      last_pull_at: '2026-08-09T09:55:00.000Z',
      last_error: null,
      updated_at: '2026-08-09T09:55:00.000Z',
    };
    const tables = {
      restaurant_external_profiles: query(profile),
      gbp_write_rollout_config_v1: query({ rollout_mode: 'on' }),
      gbp_notification_restaurant_links_v1: query({ registry_id: 'registry-1' }),
      gbp_notification_registries_v1: query({ ref_count: 2 }),
    };
    const rpc = vi.fn(async () => ({
      data: [
        {
          location_masks: ['profile'],
          attribute_paths: ['attributes'],
          observed_at: '2026-08-09T09:50:00.000Z',
          expires_at: '2026-09-06T09:50:00.000Z',
        },
      ],
      error: null,
    }));
    const client = {
      from: vi.fn((table: keyof typeof tables) => tables[table]),
      rpc,
    } as unknown as SupabaseClient<Database>;

    const state = await loadGbpOperatorConnectionState({
      client,
      restaurantId: 'rest-1',
      connection,
      now: '2026-08-09T10:00:00.000Z',
    });

    expect(state).toMatchObject({
      version: 'v1',
      restaurantId: 'rest-1',
      connectionStatus: 'linked',
      writeState: 'eligible',
      connectionGeneration: 2,
      consentEpoch: 3,
      reasonCode: 'operator_enabled',
      rollout: { eligible: true, cohort: 'all' },
      pendingUpdates: {
        state: 'known',
        locationMasks: ['profile'],
        attributePaths: ['attributes'],
      },
      notifications: { enabled: true, refCount: 2 },
      refresh: { status: 'succeeded', safeErrorCode: null },
    });
    expect(rpc).toHaveBeenCalledWith(
      'read_gbp_pending_update_masks_v1',
      expect.objectContaining({
        p_restaurant_id: 'rest-1',
        p_connection_generation: 2,
        p_consent_epoch: 3,
      }),
    );
  });

  it('fails stop to an unknown display-only overlay on prefix conflict', async () => {
    const profile = {
      id: 'profile-row-1',
      restaurant_id: 'rest-1',
      external_account_id: 'account-1',
      external_profile_id: 'profile-1',
      external_location_id: 'location-1',
      connection_generation: 2,
      consent_epoch: 3,
      write_state: 'blocked',
      write_state_reason_code: 'operator_disabled',
      last_pull_at: null,
      last_error: null,
      updated_at: '2026-08-09T09:55:00.000Z',
    };
    const tables = {
      restaurant_external_profiles: query(profile),
      gbp_write_rollout_config_v1: query({ rollout_mode: 'on' }),
      gbp_notification_restaurant_links_v1: query(null),
    };
    const client = {
      from: vi.fn((table: keyof typeof tables) => tables[table]),
      rpc: vi.fn(async () => ({
        data: [
          {
            location_masks: ['profile', 'profile.description'],
            attribute_paths: [],
            observed_at: '2026-08-09T09:50:00.000Z',
            expires_at: '2026-09-06T09:50:00.000Z',
          },
        ],
        error: null,
      })),
    } as unknown as SupabaseClient<Database>;

    const state = await loadGbpOperatorConnectionState({
      client,
      restaurantId: 'rest-1',
      connection,
      now: '2026-08-09T10:00:00.000Z',
    });

    expect(state.pendingUpdates).toEqual({
      version: 'v1',
      restaurantId: 'rest-1',
      state: 'unknown',
      observedAt: '2026-08-09T09:50:00.000Z',
      expiresAt: '2026-09-06T09:50:00.000Z',
      locationMasks: [],
      attributePaths: [],
      unknownPaths: ['profile', 'profile.description'],
    });
    expect(state.notifications).toEqual({ enabled: false, refCount: 0 });
  });
});
