import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const updateRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const getOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const readBusinessInfoMock = vi.hoisted(() => vi.fn());
const patchLocationMock = vi.hoisted(() => vi.fn());
const updateAttributesMock = vi.hoisted(() => vi.fn());
const buildPullProfilePatchMock = vi.hoisted(() => vi.fn());
const buildPullOperatingHoursPayloadMock = vi.hoisted(() => vi.fn());
const buildPullServicePeriodsPayloadMock = vi.hoisted(() => vi.fn());
const buildPushProfilePatchMock = vi.hoisted(() => vi.fn());
const buildPushOperatingHoursPatchMock = vi.hoisted(() => vi.fn());
const buildPushServicePeriodsPatchMock = vi.hoisted(() => vi.fn());
const canPushServicePeriodsMock = vi.hoisted(() => vi.fn());
const syncBusinessInfoMock = vi.hoisted(() => vi.fn());
const assertPushEnabledMock = vi.hoisted(() => vi.fn());
const pushSuccessPayloadMock = vi.hoisted(() => vi.fn());
const getLinkedLocationMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const updateExternalProfileMock = vi.hoisted(() => vi.fn());
const assertServicePeriodsCapabilityMock = vi.hoisted(() => vi.fn());
const assertServicePeriodsPatchMock = vi.hoisted(() => vi.fn());
const getProviderReferenceUpdatedAtMock = vi.hoisted(() => vi.fn());
const resolveDirectionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantDetails: getRestaurantDetailsMock,
  updateRestaurantDetails: updateRestaurantDetailsMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: getOperatingHoursMock,
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: getServicePeriodsMock,
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/google-business-profile/business-info', () => ({
  readGoogleBusinessProfileBusinessInfo: readBusinessInfoMock,
}));

vi.mock('@/server/google-business-profile/client', () => ({
  patchGoogleBusinessProfileLocation: patchLocationMock,
  updateGoogleBusinessProfileLocationAttributes: updateAttributesMock,
}));

vi.mock('@/server/google-business-profile/core-sync', () => ({
  buildPullOperatingHoursPayload: buildPullOperatingHoursPayloadMock,
  buildPullProfilePatch: buildPullProfilePatchMock,
  buildPullServicePeriodsPayload: buildPullServicePeriodsPayloadMock,
  buildPushOperatingHoursLocationPatch: buildPushOperatingHoursPatchMock,
  buildPushProfileLocationPatch: buildPushProfilePatchMock,
  buildPushServicePeriodsLocationPatch: buildPushServicePeriodsPatchMock,
  canPushServicePeriodsToGoogle: canPushServicePeriodsMock,
}));

vi.mock('@/server/google-business-profile/serviceBusinessInfoSyncRuntime', () => ({
  syncGoogleBusinessProfileBusinessInformationForClient: syncBusinessInfoMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionContext', () => ({
  assertGooglePushEnabled: assertPushEnabledMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionLifecyclePayloads', () => ({
  buildGooglePushSuccessExternalProfileUpdate: pushSuccessPayloadMock,
}));

vi.mock('@/server/google-business-profile/serviceLinkedLocationRuntime', () => ({
  getLinkedExternalProfileWithLocation: getLinkedLocationMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  findExternalProfile: findExternalProfileMock,
  updateExternalProfile: updateExternalProfileMock,
}));

vi.mock('@/server/google-business-profile/serviceSyncPlanning', () => ({
  assertGoogleServicePeriodsPushCapability: assertServicePeriodsCapabilityMock,
  assertGoogleServicePeriodsPushPatch: assertServicePeriodsPatchMock,
  getProviderReferenceUpdatedAt: getProviderReferenceUpdatedAtMock,
  resolveRequestedDirection: resolveDirectionMock,
}));

import {
  patchRestaurantGoogleBusinessProfileLocationFieldsForClient,
  syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient,
  syncRestaurantProfileWithGoogleBusinessProfileForClient,
  syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient,
} from '@/server/google-business-profile/serviceCoreSyncRuntime';

function profile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Local Name',
    contactPhone: '+44 20 0000 0000',
    address: 'Local address',
    googleMapUrl: null,
    googleReviewUrl: null,
    timezone: 'Europe/London',
    updatedAt: '2026-05-22T07:00:00.000Z',
    ...overrides,
  };
}

function linkedContext() {
  return {
    externalProfile: { id: 'external-1', push_enabled: true },
    accessToken: 'access-token',
    locationResourceName: 'locations/1',
    location: { name: 'locations/1' },
  };
}

const refreshedState = {
  businessInfo: { links: [], addresses: [], phoneNumbers: [], categories: [] },
  externalLocationTitle: 'Google Name',
  externalLocationName: 'locations/1',
};

describe('google business profile service core sync runtime', () => {
  beforeEach(() => {
    getRestaurantDetailsMock.mockReset();
    updateRestaurantDetailsMock.mockReset();
    getOperatingHoursMock.mockReset();
    updateOperatingHoursMock.mockReset();
    getServicePeriodsMock.mockReset();
    updateServicePeriodsMock.mockReset();
    readBusinessInfoMock.mockReset();
    patchLocationMock.mockReset();
    updateAttributesMock.mockReset();
    buildPullProfilePatchMock.mockReset();
    buildPullOperatingHoursPayloadMock.mockReset();
    buildPullServicePeriodsPayloadMock.mockReset();
    buildPushProfilePatchMock.mockReset();
    buildPushOperatingHoursPatchMock.mockReset();
    buildPushServicePeriodsPatchMock.mockReset();
    canPushServicePeriodsMock.mockReset();
    syncBusinessInfoMock.mockReset();
    assertPushEnabledMock.mockReset();
    pushSuccessPayloadMock.mockReset();
    getLinkedLocationMock.mockReset();
    findExternalProfileMock.mockReset();
    updateExternalProfileMock.mockReset();
    assertServicePeriodsCapabilityMock.mockReset();
    assertServicePeriodsPatchMock.mockReset();
    getProviderReferenceUpdatedAtMock.mockReset();
    resolveDirectionMock.mockReset();

    syncBusinessInfoMock.mockResolvedValue(refreshedState);
    findExternalProfileMock.mockResolvedValue({ last_pull_at: '2026-05-22T06:00:00.000Z' });
    getProviderReferenceUpdatedAtMock.mockReturnValue('2026-05-22T06:00:00.000Z');
    pushSuccessPayloadMock.mockImplementation((pushedAt: string) => ({
      last_push_at: pushedAt,
      connection_status: 'linked',
      last_error: null,
    }));
    getLinkedLocationMock.mockResolvedValue(linkedContext());
  });

  it('pulls profile fields from refreshed Google business info into restaurant details', async () => {
    getRestaurantDetailsMock.mockResolvedValue(profile());
    resolveDirectionMock.mockReturnValue('pull_from_gbp');
    buildPullProfilePatchMock.mockReturnValue({ name: 'Google Name' });
    updateRestaurantDetailsMock.mockResolvedValue(profile({ name: 'Google Name' }));

    await expect(
      syncRestaurantProfileWithGoogleBusinessProfileForClient({
        restaurantId: 'restaurant-1',
        direction: 'pull_from_gbp',
        fields: ['name'],
        client: {} as never,
      }),
    ).resolves.toMatchObject({ name: 'Google Name' });

    expect(buildPullProfilePatchMock).toHaveBeenCalledWith({
      businessInfo: refreshedState.businessInfo,
      externalLocationTitle: 'Google Name',
      fields: ['name'],
    });
    expect(updateRestaurantDetailsMock).toHaveBeenCalledWith(
      'restaurant-1',
      { timezone: 'Europe/London', name: 'Google Name' },
      {},
    );
    expect(getLinkedLocationMock).not.toHaveBeenCalled();
  });

  it('returns the local profile without patching Google when profile push has no update mask', async () => {
    getRestaurantDetailsMock.mockResolvedValue(profile());
    resolveDirectionMock.mockReturnValue('push_to_gbp');
    buildPushProfilePatchMock.mockReturnValue({ payload: {}, updateMask: [] });

    await expect(
      syncRestaurantProfileWithGoogleBusinessProfileForClient({
        restaurantId: 'restaurant-1',
        direction: 'push_to_gbp',
        client: {} as never,
      }),
    ).resolves.toMatchObject({ name: 'Local Name' });

    expect(getLinkedLocationMock).toHaveBeenCalledWith('restaurant-1', {});
    expect(assertPushEnabledMock).toHaveBeenCalledWith({ id: 'external-1', push_enabled: true });
    expect(patchLocationMock).not.toHaveBeenCalled();
    expect(updateExternalProfileMock).not.toHaveBeenCalled();
  });

  it('pushes operating-hours patches with validate-only before write and refreshes local state', async () => {
    const initialSnapshot = { updatedAt: '2026-05-22T07:00:00.000Z', days: [] };
    const refreshedSnapshot = { updatedAt: '2026-05-22T08:00:00.000Z', days: [] };
    getOperatingHoursMock
      .mockResolvedValueOnce(initialSnapshot)
      .mockResolvedValueOnce(refreshedSnapshot);
    resolveDirectionMock.mockReturnValue('push_to_gbp');
    buildPushOperatingHoursPatchMock.mockReturnValue({
      payload: { regularHours: { periods: [] } },
      updateMask: ['regularHours'],
    });

    await expect(
      syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient({
        restaurantId: 'restaurant-1',
        direction: 'push_to_gbp',
        client: {} as never,
        clock: () => '2026-05-22T08:01:00.000Z',
      }),
    ).resolves.toBe(refreshedSnapshot);

    expect(patchLocationMock).toHaveBeenNthCalledWith(
      1,
      'access-token',
      'locations/1',
      { regularHours: { periods: [] } },
      ['regularHours'],
      { validateOnly: true },
    );
    expect(patchLocationMock).toHaveBeenNthCalledWith(
      2,
      'access-token',
      'locations/1',
      { regularHours: { periods: [] } },
      ['regularHours'],
    );
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      {
        last_push_at: '2026-05-22T08:01:00.000Z',
        connection_status: 'linked',
        last_error: null,
      },
      {},
    );
    expect(syncBusinessInfoMock).toHaveBeenLastCalledWith({
      restaurantId: 'restaurant-1',
      client: {},
      runKind: 'core_sync',
    });
  });

  it('applies service-period push capability and patch guards before Google writes', async () => {
    const error = new Error('Kitchen hours are not writable.');
    getServicePeriodsMock.mockResolvedValue([{ updatedAt: '2026-05-22T07:00:00.000Z' }]);
    resolveDirectionMock.mockReturnValue('push_to_gbp');
    canPushServicePeriodsMock.mockReturnValue(false);
    assertServicePeriodsCapabilityMock.mockImplementation(() => {
      throw error;
    });

    await expect(
      syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient({
        restaurantId: 'restaurant-1',
        direction: 'push_to_gbp',
        client: {} as never,
      }),
    ).rejects.toThrow(error);

    expect(canPushServicePeriodsMock).toHaveBeenCalledWith({ name: 'locations/1' });
    expect(assertServicePeriodsCapabilityMock).toHaveBeenCalledWith(false);
    expect(buildPushServicePeriodsPatchMock).not.toHaveBeenCalled();
    expect(patchLocationMock).not.toHaveBeenCalled();
  });

  it('patches location fields and attributes with deduplicated masks', async () => {
    readBusinessInfoMock.mockResolvedValue({ details: null });

    await expect(
      patchRestaurantGoogleBusinessProfileLocationFieldsForClient({
        restaurantId: 'restaurant-1',
        locationPatch: { title: 'Updated name' },
        updateMask: ['title', 'title', ''],
        attributesPatch: {
          attributes: [{ name: 'attributes/serves_dinner' }],
          attributeMask: ['attributes/serves_dinner', 'attributes/serves_dinner', ''],
        },
        client: {} as never,
        clock: () => '2026-05-22T08:02:00.000Z',
      }),
    ).resolves.toEqual({ details: null });

    expect(patchLocationMock).toHaveBeenNthCalledWith(
      1,
      'access-token',
      'locations/1',
      { title: 'Updated name' },
      ['title'],
      { validateOnly: true },
    );
    expect(patchLocationMock).toHaveBeenNthCalledWith(
      2,
      'access-token',
      'locations/1',
      { title: 'Updated name' },
      ['title'],
    );
    expect(updateAttributesMock).toHaveBeenCalledWith(
      'access-token',
      'locations/1',
      { attributes: [{ name: 'attributes/serves_dinner' }] },
      ['attributes/serves_dinner'],
    );
    expect(updateExternalProfileMock).toHaveBeenCalledWith(
      'external-1',
      {
        last_push_at: '2026-05-22T08:02:00.000Z',
        connection_status: 'linked',
        last_error: null,
      },
      {},
    );
    expect(readBusinessInfoMock).toHaveBeenCalledWith('restaurant-1', {});
  });
});
