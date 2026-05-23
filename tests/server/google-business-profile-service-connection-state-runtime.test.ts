import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleBusinessProfileEnv = vi.hoisted(() => ({ configured: true }));
const readBusinessInfoMock = vi.hoisted(() => vi.fn());
const discoverLocationsMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const getCredentialRowMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    get googleBusinessProfile() {
      return googleBusinessProfileEnv;
    },
  },
}));

vi.mock('@/server/google-business-profile/business-info', () => ({
  readGoogleBusinessProfileBusinessInfo: readBusinessInfoMock,
}));

vi.mock('@/server/google-business-profile/serviceAccessRuntime', () => ({
  discoverGoogleBusinessProfileLocationsForProfile: discoverLocationsMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  findExternalProfile: findExternalProfileMock,
  getCredentialRow: getCredentialRowMock,
}));

import { getGoogleBusinessProfileConnectionStateForClient } from '@/server/google-business-profile/serviceConnectionStateRuntime';

const businessInfo = {
  details: null,
  addresses: [],
  phoneNumbers: [],
  categories: [],
  links: [],
  serviceAreas: [],
  serviceItems: [],
  attributes: [],
  regularHours: [],
  specialHours: [],
  labels: [],
  status: null,
  coreNormalization: null,
};

function externalProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'external-1',
    connection_status: 'linked',
    push_enabled: true,
    external_account_id: 'account-1',
    external_account_name: 'accounts/1',
    external_location_id: 'location-1',
    external_location_name: 'locations/1',
    external_location_title: 'The Crown',
    external_place_id: 'place-1',
    provider_timezone: 'Europe/London',
    last_pull_at: '2026-05-22T07:00:00.000Z',
    last_push_at: null,
    last_error: null,
    ...overrides,
  };
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    connected_google_email: 'owner@example.com',
    connected_google_name: 'Owner',
    ...overrides,
  };
}

describe('google business profile connection state runtime', () => {
  beforeEach(() => {
    googleBusinessProfileEnv.configured = true;
    readBusinessInfoMock.mockReset();
    discoverLocationsMock.mockReset();
    findExternalProfileMock.mockReset();
    getCredentialRowMock.mockReset();

    readBusinessInfoMock.mockResolvedValue(businessInfo);
  });

  it('builds an unlinked state when no external profile exists', async () => {
    findExternalProfileMock.mockResolvedValue(null);

    const state = await getGoogleBusinessProfileConnectionStateForClient(
      'restaurant-1',
      {} as never,
    );

    expect(state).toMatchObject({
      isConfigured: true,
      status: 'unlinked',
      pushEnabled: false,
      connectedGoogleEmail: null,
      externalLocationId: null,
      availableLocations: [],
      businessInfo,
    });
    expect(getCredentialRowMock).not.toHaveBeenCalled();
    expect(discoverLocationsMock).not.toHaveBeenCalled();
  });

  it('returns persisted connection fields without discovery by default', async () => {
    findExternalProfileMock.mockResolvedValue(externalProfile());
    getCredentialRowMock.mockResolvedValue(credential());

    const state = await getGoogleBusinessProfileConnectionStateForClient(
      'restaurant-1',
      {} as never,
    );

    expect(state).toMatchObject({
      isConfigured: true,
      status: 'linked',
      pushEnabled: true,
      connectedGoogleEmail: 'owner@example.com',
      connectedGoogleName: 'Owner',
      externalLocationId: 'location-1',
      externalLocationName: 'locations/1',
      availableLocations: [],
    });
    expect(discoverLocationsMock).not.toHaveBeenCalled();
  });

  it('includes discovered locations and refreshed profile fields when requested', async () => {
    const initialProfile = externalProfile();
    const refreshedProfile = externalProfile({
      external_location_title: 'The Crown Updated',
      last_pull_at: '2026-05-22T08:00:00.000Z',
    });
    findExternalProfileMock
      .mockResolvedValueOnce(initialProfile)
      .mockResolvedValueOnce(refreshedProfile);
    getCredentialRowMock.mockResolvedValue(credential());
    discoverLocationsMock.mockResolvedValue({
      credential: credential({ connected_google_name: 'Updated Owner' }),
      availableLocations: [
        {
          accountName: 'accounts/1',
          accountId: 'account-1',
          locationName: 'locations/1',
          locationId: 'location-1',
          title: 'The Crown',
          address: null,
          primaryCategory: null,
          placeId: 'place-1',
        },
      ],
    });

    const state = await getGoogleBusinessProfileConnectionStateForClient(
      'restaurant-1',
      {} as never,
      { includeAvailableLocations: true, forceRefreshLocations: true },
    );

    expect(discoverLocationsMock).toHaveBeenCalledWith(initialProfile, {}, { forceRefresh: true });
    expect(state).toMatchObject({
      connectedGoogleName: 'Updated Owner',
      externalLocationTitle: 'The Crown Updated',
      lastPullAt: '2026-05-22T08:00:00.000Z',
      availableLocations: [
        expect.objectContaining({
          accountId: 'account-1',
          locationId: 'location-1',
        }),
      ],
    });
  });

  it('falls back to refreshed persisted state when location discovery fails', async () => {
    const initialProfile = externalProfile({ id: 'external-1', connection_status: 'linked' });
    const refreshedProfile = externalProfile({
      id: 'external-2',
      connection_status: 'reauth_required',
      last_error: 'Reconnect Google.',
    });
    findExternalProfileMock
      .mockResolvedValueOnce(initialProfile)
      .mockResolvedValueOnce(refreshedProfile);
    getCredentialRowMock
      .mockResolvedValueOnce(credential({ connected_google_name: 'Initial Owner' }))
      .mockResolvedValueOnce(credential({ connected_google_name: 'Refreshed Owner' }));
    discoverLocationsMock.mockRejectedValue(new Error('Google unavailable'));

    const state = await getGoogleBusinessProfileConnectionStateForClient(
      'restaurant-1',
      {} as never,
      { includeAvailableLocations: true },
    );

    expect(state).toMatchObject({
      status: 'reauth_required',
      connectedGoogleName: 'Refreshed Owner',
      lastError: 'Reconnect Google.',
      availableLocations: [],
    });
    expect(getCredentialRowMock).toHaveBeenNthCalledWith(1, 'external-1', {});
    expect(getCredentialRowMock).toHaveBeenNthCalledWith(2, 'external-2', {});
  });
});
