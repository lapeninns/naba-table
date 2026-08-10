import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const businessDetailsStatusForClientMock = vi.hoisted(() => vi.fn());
const foodMenusContextForClientMock = vi.hoisted(() => vi.fn());
const createAuthorizationForClientMock = vi.hoisted(() => vi.fn());
const completeAuthorizationForClientMock = vi.hoisted(() => vi.fn());
const businessInfoSyncForClientMock = vi.hoisted(() => vi.fn());
const disconnectForClientMock = vi.hoisted(() => vi.fn());
const availableLocationsForClientMock = vi.hoisted(() => vi.fn());
const linkLocationForClientMock = vi.hoisted(() => vi.fn());
const connectionStateForClientMock = vi.hoisted(() => vi.fn());
const patchLocationFieldsForClientMock = vi.hoisted(() => vi.fn());
const syncOperatingHoursForClientMock = vi.hoisted(() => vi.fn());
const syncProfileForClientMock = vi.hoisted(() => vi.fn());
const syncServicePeriodsForClientMock = vi.hoisted(() => vi.fn());
const setNotificationParticipationForClientMock = vi.hoisted(() => vi.fn());
const findExternalProfileMock = vi.hoisted(() => vi.fn());
const hasNotificationLinkMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    dualSync: {
      pubsubIngress: {
        enabled: true,
        topic: 'projects/project-1/topics/gbp',
      },
    },
  },
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
}));

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  findExternalProfile: findExternalProfileMock,
  hasNotificationLink: hasNotificationLinkMock,
}));

vi.mock('@/server/google-business-profile/serviceNotificationParticipationRuntime', () => ({
  setGoogleBusinessProfileNotificationParticipationForClient:
    setNotificationParticipationForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceBusinessDetailsStatusRuntime', () => ({
  getGoogleBusinessProfileBusinessDetailsStatusForClient: businessDetailsStatusForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceFoodMenusContext', () => ({
  getGoogleBusinessProfileFoodMenusContext: foodMenusContextForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceAuthorizationRuntime', () => ({
  createGoogleBusinessProfileAuthorizationForClient: createAuthorizationForClientMock,
  completeGoogleBusinessProfileAuthorizationForClient: completeAuthorizationForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceBusinessInfoSyncRuntime', () => ({
  syncGoogleBusinessProfileBusinessInformationForClient: businessInfoSyncForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionLifecycleRuntime', () => ({
  disconnectGoogleBusinessProfileConnectionForClient: disconnectForClientMock,
  getGoogleBusinessProfileAvailableLocationsForClient: availableLocationsForClientMock,
  linkGoogleBusinessProfileLocationForClient: linkLocationForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionStateRuntime', () => ({
  getGoogleBusinessProfileConnectionStateForClient: connectionStateForClientMock,
}));

vi.mock('@/server/google-business-profile/serviceCoreSyncRuntime', () => ({
  patchRestaurantGoogleBusinessProfileLocationFieldsForClient: patchLocationFieldsForClientMock,
  syncRestaurantOperatingHoursWithGoogleBusinessProfileForClient: syncOperatingHoursForClientMock,
  syncRestaurantProfileWithGoogleBusinessProfileForClient: syncProfileForClientMock,
  syncRestaurantServicePeriodsWithGoogleBusinessProfileForClient: syncServicePeriodsForClientMock,
}));

import {
  completeGoogleBusinessProfileAuthorization,
  createGoogleBusinessProfileAuthorization,
  createGoogleBusinessProfileAuthorizationUrl,
  disconnectGoogleBusinessProfileConnection,
  getGoogleBusinessProfileAvailableLocations,
  getGoogleBusinessProfileBusinessDetailsStatus,
  getGoogleBusinessProfileConnectionState,
  getGoogleBusinessProfileFoodMenusContext,
  linkGoogleBusinessProfileLocation,
  patchRestaurantGoogleBusinessProfileLocationFields,
  syncGoogleBusinessProfileBusinessInformation,
  setGoogleBusinessProfileNotificationParticipation,
  syncRestaurantOperatingHoursWithGoogleBusinessProfile,
  syncRestaurantProfileWithGoogleBusinessProfile,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile,
} from '@/server/google-business-profile/servicePublic';

const serviceClient = { role: 'service' } as never;
const tenantClient = {
  role: 'tenant',
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) },
} as never;

beforeEach(() => {
  getServiceSupabaseClientMock.mockReset().mockReturnValue(serviceClient);
  tenantClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  for (const mock of [
    businessDetailsStatusForClientMock,
    foodMenusContextForClientMock,
    createAuthorizationForClientMock,
    completeAuthorizationForClientMock,
    businessInfoSyncForClientMock,
    disconnectForClientMock,
    availableLocationsForClientMock,
    linkLocationForClientMock,
    connectionStateForClientMock,
    patchLocationFieldsForClientMock,
    syncOperatingHoursForClientMock,
    syncProfileForClientMock,
    syncServicePeriodsForClientMock,
    setNotificationParticipationForClientMock,
  ]) {
    mock.mockReset();
  }
  findExternalProfileMock.mockReset().mockResolvedValue({ id: 'external-1' });
  hasNotificationLinkMock.mockReset().mockResolvedValue(false);
});

describe('servicePublic facade', () => {
  it('falls back to the service-role Supabase client when no client is provided @contract @security', async () => {
    const status = { connection: 'connected' };
    businessDetailsStatusForClientMock.mockResolvedValue(status);

    await expect(getGoogleBusinessProfileBusinessDetailsStatus('rest-1')).resolves.toBe(status);

    expect(getServiceSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(businessDetailsStatusForClientMock).toHaveBeenCalledWith('rest-1', serviceClient);
  });

  it('respects an explicit tenant-scoped client and never creates a service client @contract @security', async () => {
    businessDetailsStatusForClientMock.mockResolvedValue({ connection: 'connected' });

    await getGoogleBusinessProfileBusinessDetailsStatus('rest-1', tenantClient);

    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(businessDetailsStatusForClientMock).toHaveBeenCalledWith('rest-1', tenantClient);
  });

  it('forwards food menus context params including requirePushEnabled @contract', async () => {
    const context = { foodMenusName: 'accounts/1/locations/2/foodMenus' };
    foodMenusContextForClientMock.mockResolvedValue(context);

    await expect(
      getGoogleBusinessProfileFoodMenusContext({
        restaurantId: 'rest-1',
        requirePushEnabled: true,
      }),
    ).resolves.toBe(context);

    expect(foodMenusContextForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      client: serviceClient,
      requirePushEnabled: true,
    });
  });

  it('creates authorizations with the requesting user and return path @contract @security', async () => {
    const created = { authorizationUrl: 'https://google.example/auth', stateToken: 'state-1' };
    createAuthorizationForClientMock.mockResolvedValue(created);

    await expect(
      createGoogleBusinessProfileAuthorization({
        restaurantId: 'rest-1',
        requestedByUserId: 'user-1',
        returnPath: '/app/settings',
      }),
    ).resolves.toBe(created);

    expect(createAuthorizationForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      requestedByUserId: 'user-1',
      returnPath: '/app/settings',
      client: serviceClient,
    });
  });

  it('unwraps only the authorization URL from createGoogleBusinessProfileAuthorizationUrl @contract', async () => {
    createAuthorizationForClientMock.mockResolvedValue({
      authorizationUrl: 'https://google.example/auth?state=state-1',
      stateToken: 'state-1',
    });

    await expect(
      createGoogleBusinessProfileAuthorizationUrl({
        restaurantId: 'rest-1',
        requestedByUserId: 'user-1',
      }),
    ).resolves.toBe('https://google.example/auth?state=state-1');
  });

  it('completes authorizations with state token, code, and tenant expectation @contract @security', async () => {
    const completion = { restaurantId: 'rest-1', returnPath: '/app/settings' };
    completeAuthorizationForClientMock.mockResolvedValue(completion);

    await expect(
      completeGoogleBusinessProfileAuthorization({
        stateToken: 'state-1',
        code: 'auth-code',
        requestedByUserId: 'user-1',
        expectedRestaurantId: 'rest-1',
        client: tenantClient,
      }),
    ).resolves.toBe(completion);

    expect(completeAuthorizationForClientMock).toHaveBeenCalledWith({
      stateToken: 'state-1',
      code: 'auth-code',
      requestedByUserId: 'user-1',
      expectedRestaurantId: 'rest-1',
      client: tenantClient,
    });
  });

  it('reads connection state with default and explicit options @contract', async () => {
    const state = { status: 'linked' };
    connectionStateForClientMock.mockResolvedValue(state);

    await expect(getGoogleBusinessProfileConnectionState('rest-1')).resolves.toBe(state);
    expect(connectionStateForClientMock).toHaveBeenLastCalledWith('rest-1', serviceClient, {});

    await getGoogleBusinessProfileConnectionState('rest-1', tenantClient, {
      includeLocations: true,
    } as never);
    expect(connectionStateForClientMock).toHaveBeenLastCalledWith('rest-1', tenantClient, {
      includeLocations: true,
    });
  });

  it('passes forceRefresh through and returns empty location lists untouched @contract', async () => {
    availableLocationsForClientMock.mockResolvedValue([]);

    await expect(
      getGoogleBusinessProfileAvailableLocations('rest-1', undefined, { forceRefresh: true }),
    ).resolves.toEqual([]);

    expect(availableLocationsForClientMock).toHaveBeenCalledWith('rest-1', serviceClient, {
      forceRefresh: true,
    });
  });

  it('forwards business information sync run kinds @contract', async () => {
    const state = { status: 'linked' };
    businessInfoSyncForClientMock.mockResolvedValue(state);

    await expect(
      syncGoogleBusinessProfileBusinessInformation('rest-1', undefined, {
        runKind: 'location_selection',
      }),
    ).resolves.toBe(state);

    expect(businessInfoSyncForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      client: serviceClient,
      runKind: 'location_selection',
    });
  });

  it('forwards profile sync direction, fields, and approved profile @contract', async () => {
    const outcome = { pushed: true };
    syncProfileForClientMock.mockResolvedValue(outcome);
    const approvedProfile = { name: 'Old Crown' } as never;

    await expect(
      syncRestaurantProfileWithGoogleBusinessProfile({
        restaurantId: 'rest-1',
        direction: 'push' as never,
        fields: ['name', 'contactPhone'],
        approvedProfile,
      }),
    ).resolves.toBe(outcome);

    expect(syncProfileForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: 'push',
      fields: ['name', 'contactPhone'],
      approvedProfile,
      client: serviceClient,
    });
  });

  it('forwards operating hours selection and approved snapshot @contract', async () => {
    syncOperatingHoursForClientMock.mockResolvedValue({ pushed: false });
    const selection = { weeklyDays: [1, 2] } as never;
    const approvedSnapshot = { weekly: [] } as never;

    await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
      restaurantId: 'rest-1',
      selection,
      approvedSnapshot,
      client: tenantClient,
    });

    expect(syncOperatingHoursForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: undefined,
      selection,
      approvedSnapshot,
      client: tenantClient,
    });
  });

  it('forwards service period selection and approved periods @contract', async () => {
    syncServicePeriodsForClientMock.mockResolvedValue({ pushed: true });
    const approvedPeriods = [{ name: 'Dinner' }] as never;

    await syncRestaurantServicePeriodsWithGoogleBusinessProfile({
      restaurantId: 'rest-1',
      direction: 'pull' as never,
      approvedPeriods,
    });

    expect(syncServicePeriodsForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      direction: 'pull',
      selection: undefined,
      approvedPeriods,
      client: serviceClient,
    });
  });

  it('forwards location and attribute patches with their masks @contract', async () => {
    patchLocationFieldsForClientMock.mockResolvedValue({ updated: true });
    const attributesPatch = {
      attributes: [{ name: 'attributes/wi_fi' }],
      attributeMask: ['attributes/wi_fi'],
    };

    await patchRestaurantGoogleBusinessProfileLocationFields({
      restaurantId: 'rest-1',
      locationPatch: { title: 'New Name' },
      updateMask: ['title'],
      attributesPatch,
    });

    expect(patchLocationFieldsForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      locationPatch: { title: 'New Name' },
      updateMask: ['title'],
      attributesPatch,
      client: serviceClient,
    });
  });

  it('links and disconnects locations for the given restaurant @contract @security', async () => {
    const linkedState = { status: 'linked' };
    const disconnectedState = { status: 'disconnected' };
    linkLocationForClientMock.mockResolvedValue(linkedState);
    disconnectForClientMock.mockResolvedValue(disconnectedState);
    const input = { locationId: 'locations/123' } as never;

    await expect(linkGoogleBusinessProfileLocation('rest-1', input)).resolves.toBe(linkedState);
    expect(linkLocationForClientMock).toHaveBeenCalledWith('rest-1', input, serviceClient);

    await expect(disconnectGoogleBusinessProfileConnection('rest-1', tenantClient)).resolves.toBe(
      disconnectedState,
    );
    expect(disconnectForClientMock).toHaveBeenCalledWith(
      'rest-1',
      tenantClient,
      expect.objectContaining({ actorUserId: 'user-1' }),
    );
    expect(setNotificationParticipationForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      enabled: false,
      managedTopic: 'projects/project-1/topics/gbp',
      client: tenantClient,
    });
    expect(setNotificationParticipationForClientMock.mock.invocationCallOrder[0]).toBeLessThan(
      disconnectForClientMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('uses the authenticated server operator and current DB context for participation', async () => {
    setNotificationParticipationForClientMock.mockResolvedValue({ enabled: true, refCount: 1 });

    await expect(
      setGoogleBusinessProfileNotificationParticipation('rest-1', true, tenantClient),
    ).resolves.toEqual({ enabled: true, refCount: 1 });

    expect(setNotificationParticipationForClientMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      enabled: true,
      managedTopic: 'projects/project-1/topics/gbp',
      client: tenantClient,
    });
  });

  it('does not begin revocation when provider notification teardown is uncertain', async () => {
    setNotificationParticipationForClientMock.mockRejectedValue(
      new Error('provider notification teardown failed'),
    );

    await expect(disconnectGoogleBusinessProfileConnection('rest-1', tenantClient)).rejects.toThrow(
      'provider notification teardown failed',
    );

    expect(disconnectForClientMock).not.toHaveBeenCalled();
  });

  it('fails closed when disconnect has no authenticated server operator @contract @security', async () => {
    tenantClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(
      disconnectGoogleBusinessProfileConnection('rest-1', tenantClient),
    ).rejects.toMatchObject({ code: 'GBP_DISCONNECT_CONTEXT_REQUIRED', status: 401 });

    expect(disconnectForClientMock).not.toHaveBeenCalled();
  });

  it('propagates runtime errors unchanged to callers @contract', async () => {
    const failure = Object.assign(new Error('Google authorization has expired'), {
      name: 'GBP_REAUTH_REQUIRED',
    });
    connectionStateForClientMock.mockRejectedValue(failure);

    await expect(getGoogleBusinessProfileConnectionState('rest-1')).rejects.toBe(failure);
  });
});
