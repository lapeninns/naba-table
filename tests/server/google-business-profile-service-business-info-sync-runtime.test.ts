import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncCanonicalMock = vi.hoisted(() => vi.fn());
const getAttributesMock = vi.hoisted(() => vi.fn());
const getLocationProfileMock = vi.hoisted(() => vi.fn());
const parseLocationIdMock = vi.hoisted(() => vi.fn());
const getAccessTokenMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());
const ensureExternalProfileMock = vi.hoisted(() => vi.fn());
const recordSyncRunMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: {
    child: () => ({
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/server/google-business-profile/business-info', () => ({
  syncGoogleBusinessProfileCanonicalBusinessInfo: syncCanonicalMock,
}));

vi.mock('@/server/google-business-profile/client', () => ({
  getGoogleBusinessProfileLocationAttributes: getAttributesMock,
  getGoogleBusinessProfileLocationProfile: getLocationProfileMock,
  parseGoogleLocationId: parseLocationIdMock,
}));

vi.mock('@/server/google-business-profile/serviceAccessRuntime', () => ({
  getUsableGoogleBusinessProfileAccessToken: getAccessTokenMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionStateRuntime', () => ({
  getGoogleBusinessProfileConnectionStateForClient: getConnectionStateMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  ensureExternalProfile: ensureExternalProfileMock,
  recordSyncRun: recordSyncRunMock,
  updateExternalProfile: updateExternalProfileMock,
}));

import { syncGoogleBusinessProfileBusinessInformationForClient } from '@/server/google-business-profile/serviceBusinessInfoSyncRuntime';

function externalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'external-1',
    restaurant_id: 'restaurant-1',
    external_location_id: 'location-1',
    external_location_name: 'locations/1',
    external_location_title: 'Existing Title',
    external_place_id: 'existing-place',
    external_resource_name: 'locations/1',
    provider_timezone: 'Europe/London',
    ...overrides,
  };
}

function location(overrides: Record<string, unknown> = {}) {
  return {
    name: 'locations/456',
    title: 'Google Title',
    metadata: { placeId: 'place-456', timezone: 'Europe/Paris' },
    ...overrides,
  };
}

describe('google business profile business-info sync runtime', () => {
  beforeEach(() => {
    syncCanonicalMock.mockReset();
    getAttributesMock.mockReset();
    getLocationProfileMock.mockReset();
    parseLocationIdMock.mockReset();
    getAccessTokenMock.mockReset();
    getConnectionStateMock.mockReset();
    ensureExternalProfileMock.mockReset();
    recordSyncRunMock.mockReset();
    updateExternalProfileMock.mockReset();

    ensureExternalProfileMock.mockResolvedValue(externalProfile());
    getAccessTokenMock.mockResolvedValue({ accessToken: 'access-token' });
    getLocationProfileMock.mockResolvedValue(location());
    getAttributesMock.mockResolvedValue({ attributes: [{ name: 'attributes/serves_dinner' }] });
    parseLocationIdMock.mockReturnValue('456');
    getConnectionStateMock.mockResolvedValue({ status: 'linked' });
  });

  it('syncs location and attributes, records success, and returns refreshed connection state', async () => {
    const client = {} as never;
    const clock = vi
      .fn()
      .mockReturnValueOnce('2026-05-22T08:00:00.000Z')
      .mockReturnValueOnce('2026-05-22T08:01:00.000Z');

    await expect(
      syncGoogleBusinessProfileBusinessInformationForClient({
        restaurantId: 'restaurant-1',
        client,
        runKind: 'manual',
        clock,
      }),
    ).resolves.toEqual({ status: 'linked' });

    expect(ensureExternalProfileMock).toHaveBeenCalledWith('restaurant-1', client);
    expect(getAccessTokenMock).toHaveBeenCalledWith(externalProfile(), client);
    expect(getLocationProfileMock).toHaveBeenCalledWith('access-token', 'locations/1');
    expect(getAttributesMock).toHaveBeenCalledWith('access-token', 'location-1');
    expect(syncCanonicalMock).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      externalProfile: externalProfile(),
      location: location(),
      attributes: { attributes: [{ name: 'attributes/serves_dinner' }] },
      client,
      syncedAt: '2026-05-22T08:01:00.000Z',
      syncAttributes: true,
    });
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      expect.objectContaining({
        external_location_id: 'location-1',
        external_location_name: 'locations/456',
        external_location_title: 'Google Title',
        external_place_id: 'place-456',
        external_resource_name: 'locations/456',
        provider_timezone: 'Europe/Paris',
        connection_status: 'linked',
        last_pull_at: '2026-05-22T08:01:00.000Z',
        last_error: null,
      }),
      client,
    );
    expect(recordSyncRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        external_profile_id: 'external-1',
        restaurant_id: 'restaurant-1',
        run_kind: 'manual',
        status: 'success',
        started_at: '2026-05-22T08:00:00.000Z',
        finished_at: '2026-05-22T08:01:00.000Z',
        error_message: null,
        metadata: {
          locationName: 'locations/456',
          attributeSyncSkipped: false,
        },
      }),
      client,
    );
    expect(getConnectionStateMock).toHaveBeenCalledWith('restaurant-1', client);
  });

  it('downgrades attribute refresh failures to a sync warning', async () => {
    getAttributesMock.mockRejectedValue(new Error('attribute quota exceeded'));

    await syncGoogleBusinessProfileBusinessInformationForClient({
      restaurantId: 'restaurant-1',
      client: {} as never,
      runKind: 'location_selection',
      clock: () => '2026-05-22T08:00:00.000Z',
    });

    expect(syncCanonicalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: null,
        syncAttributes: false,
      }),
    );
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      expect.objectContaining({
        last_error: 'Google attributes could not be refreshed: attribute quota exceeded',
      }),
      {},
    );
    expect(recordSyncRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        run_kind: 'location_selection',
        status: 'success',
        error_message: 'Google attributes could not be refreshed: attribute quota exceeded',
        metadata: expect.objectContaining({
          attributeSyncSkipped: true,
        }),
      }),
      {},
    );
  });

  it('records failure state and rethrows fatal sync errors', async () => {
    const error = new Error('Google location unavailable.');
    getLocationProfileMock.mockRejectedValue(error);

    await expect(
      syncGoogleBusinessProfileBusinessInformationForClient({
        restaurantId: 'restaurant-1',
        client: {} as never,
        runKind: 'core_sync',
        clock: () => '2026-05-22T08:00:00.000Z',
      }),
    ).rejects.toThrow(error);

    expect(syncCanonicalMock).not.toHaveBeenCalled();
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      {
        connection_status: 'sync_error',
        last_error: 'Google location unavailable.',
      },
      {},
    );
    expect(recordSyncRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        external_profile_id: 'external-1',
        restaurant_id: 'restaurant-1',
        run_kind: 'core_sync',
        status: 'failed',
        error_message: 'Google location unavailable.',
      }),
      {},
    );
    expect(getConnectionStateMock).not.toHaveBeenCalled();
  });
});
