import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: fetchJsonMock }));

import {
  getGbpConnectionStateV1,
  previewGbpExactPublishV1,
  setGbpNotificationParticipationV1,
  setGbpWriteAccessV1,
} from '@/services/ops/dual-sync';

const NOW = '2026-08-09T12:00:00.000Z';

describe('Wave 3 GBP operator client boundaries', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses connection and notification responses received from canonical endpoints', async () => {
    // Given
    fetchJsonMock
      .mockResolvedValueOnce({
        version: 'v1',
        restaurantId: 'restaurant_1',
        provider: 'google_business_profile',
        connectionStatus: 'linked',
        writeState: 'eligible',
        connectionGeneration: 3,
        consentEpoch: 4,
        reasonCode: 'operator_enabled',
        rollout: { eligible: true, cohort: 'pilot', evaluatedAt: NOW },
        pendingUpdates: {
          version: 'v1',
          restaurantId: 'restaurant_1',
          state: 'known',
          locationMasks: ['title'],
          attributePaths: [],
          observedAt: NOW,
          expiresAt: '2026-09-06T12:00:00.000Z',
        },
        notifications: { enabled: true, refCount: 2 },
        refresh: {
          status: 'succeeded',
          lastAttemptAt: NOW,
          lastSucceededAt: NOW,
          safeErrorCode: null,
        },
      })
      .mockResolvedValueOnce({ enabled: true, refCount: 2 });

    // When
    const state = await getGbpConnectionStateV1('restaurant_1');
    const participation = await setGbpNotificationParticipationV1('restaurant_1', {
      enabled: true,
      password: 'operator-entered',
    });

    // Then
    expect(state.writeState).toBe('eligible');
    expect(participation).toEqual({ enabled: true, refCount: 2 });
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      1,
      '/api/ops/restaurants/restaurant_1/google-business-profile',
      undefined,
    );
    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      '/api/ops/restaurants/restaurant_1/google-business-profile/notifications',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('rejects provider additions at the preview client boundary', async () => {
    // Given
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    fetchJsonMock.mockResolvedValue({
      confirmationVersion: 'gbp-exact-consent-v1',
      policyVersion: 'gbp-write-policy-v1',
      rendererVersion: 'gbp-renderer-v1',
      listing: {
        restaurantId: 'restaurant_1',
        externalProfileRowId: 'profile_row_1',
        accountId: 'account_1',
        profileId: 'profile_1',
        locationId: 'location_1',
        connectionGeneration: 3,
        consentEpoch: 4,
      },
      snapshotPins: { core: 'a'.repeat(64), google: 'b'.repeat(64) },
      groups: [
        {
          groupId: 'group_1',
          writeGroup: 'profile',
          direction: 'export_to_google',
          fieldKeys: ['profile.title'],
          method: 'PATCH',
          resource: 'locations/location_1',
          updateMasks: ['title'],
          beforeDisplay: {
            core: { 'profile.title': 'Old' },
            google: { 'profile.title': 'Old' },
          },
          afterDisplay: {
            core: { 'profile.title': 'New' },
            google: { 'profile.title': 'Old' },
          },
          beforeHashes: {
            core: { 'profile.title': 'a'.repeat(64) },
            google: { 'profile.title': 'a'.repeat(64) },
          },
          afterHashes: {
            core: { 'profile.title': 'b'.repeat(64) },
            google: { 'profile.title': 'a'.repeat(64) },
          },
          requestHash: 'a'.repeat(64),
          decisionHash: 'b'.repeat(64),
          warnings: ['External listing write'],
          riskLevel: 'high',
          fullReplacement: false,
        },
      ],
      planFingerprint: 'a'.repeat(64),
      issuedAt: NOW,
      expiresAt: '2026-08-09T12:15:00.000Z',
      rawProviderResponse: { title: 'untrusted' },
    });

    // When / Then
    await expect(
      previewGbpExactPublishV1('restaurant_1', {
        decisions: [
          {
            fieldKey: 'profile.title',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: null,
            pinnedGbpHash: null,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  it('sets write eligibility through the approved write-access endpoint', async () => {
    // Given
    fetchJsonMock.mockResolvedValue({
      version: 'v1',
      restaurantId: 'restaurant_1',
      provider: 'google_business_profile',
      connectionStatus: 'linked',
      writeState: 'blocked',
      connectionGeneration: 3,
      consentEpoch: 5,
      reasonCode: 'operator_disabled',
      rollout: { eligible: true, cohort: 'pilot', evaluatedAt: NOW },
      pendingUpdates: {
        version: 'v1',
        restaurantId: 'restaurant_1',
        state: 'known',
        locationMasks: [],
        attributePaths: [],
        observedAt: NOW,
        expiresAt: '2026-09-06T12:00:00.000Z',
      },
      notifications: { enabled: true, refCount: 2 },
      refresh: {
        status: 'succeeded',
        lastAttemptAt: NOW,
        lastSucceededAt: NOW,
        safeErrorCode: null,
      },
    });

    // When
    const result = await setGbpWriteAccessV1('restaurant_1', {
      eligible: false,
      password: 'operator-entered',
    });

    // Then
    expect(result.writeState).toBe('blocked');
    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/ops/restaurants/restaurant_1/google-business-profile/write-access',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eligible: false, password: 'operator-entered' }),
      },
    );
  });
});
