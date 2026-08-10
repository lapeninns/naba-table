import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureExternalProfileMock = vi.hoisted(() => vi.fn());
const getAccessTokenMock = vi.hoisted(() => vi.fn());
const createNotificationClientMock = vi.hoisted(() => vi.fn());
const createProviderPortMock = vi.hoisted(() => vi.fn());
const createRegistryMock = vi.hoisted(() => vi.fn());
const enableParticipationMock = vi.hoisted(() => vi.fn());
const disableParticipationMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/serviceRepository', () => ({
  ensureExternalProfile: ensureExternalProfileMock,
}));
vi.mock('@/server/google-business-profile/serviceAccessRuntime', () => ({
  getUsableGoogleBusinessProfileAccessToken: getAccessTokenMock,
}));
vi.mock('@/server/google-business-profile/notificationClient', () => ({
  createGoogleNotificationAdministrationClient: createNotificationClientMock,
}));
vi.mock('@/server/dual-sync/notifications', () => ({
  createGoogleAccountNotificationPort: createProviderPortMock,
  createSupabaseGoogleNotificationRegistry: createRegistryMock,
  enableGoogleUpdateParticipation: enableParticipationMock,
  disableGoogleUpdateParticipation: disableParticipationMock,
  GoogleNotificationTopicConflictError: class GoogleNotificationTopicConflictError extends Error {},
}));

import { GoogleNotificationTopicConflictError } from '@/server/dual-sync/notifications';
import { setGoogleBusinessProfileNotificationParticipationForClient } from '@/server/google-business-profile/serviceNotificationParticipationRuntime';

const profile = {
  id: 'external-1',
  restaurant_id: 'restaurant-1',
  provider: 'google_business_profile',
  external_account_id: 'account-1',
  external_profile_id: 'profile-1',
  external_location_id: 'location-1',
  connection_generation: 4,
  consent_epoch: 7,
};

describe('Google notification participation provider runtime', () => {
  beforeEach(() => {
    ensureExternalProfileMock.mockReset().mockResolvedValue(profile);
    getAccessTokenMock.mockReset().mockResolvedValue({ accessToken: 'access-token' });
    createNotificationClientMock.mockReset().mockReturnValue({ kind: 'notification-client' });
    createProviderPortMock.mockReset().mockReturnValue({ kind: 'provider-port' });
    createRegistryMock.mockReset().mockReturnValue({ kind: 'registry-port' });
    enableParticipationMock.mockReset().mockResolvedValue({ refCount: 2 });
    disableParticipationMock.mockReset().mockResolvedValue({ refCount: 0 });
  });

  it('enables with a server-resolved exact current fence', async () => {
    // Given
    const client = { kind: 'db' } as never;

    // When
    const result = await setGoogleBusinessProfileNotificationParticipationForClient({
      restaurantId: 'restaurant-1',
      enabled: true,
      managedTopic: 'projects/project-1/topics/gbp',
      client,
    });

    // Then
    expect(result).toEqual({ enabled: true, refCount: 2 });
    expect(enableParticipationMock).toHaveBeenCalledWith({
      fence: {
        restaurantId: 'restaurant-1',
        externalProfileRowId: 'external-1',
        externalAccountId: 'account-1',
        externalProfileId: 'profile-1',
        externalLocationId: 'location-1',
        connectionGeneration: 4,
        consentEpoch: 7,
      },
      managedTopic: 'projects/project-1/topics/gbp',
      provider: { kind: 'provider-port' },
      registry: { kind: 'registry-port' },
    });
    expect(disableParticipationMock).not.toHaveBeenCalled();
  });

  it('disables through the DB-first account participation contract', async () => {
    // Given
    const client = { kind: 'db' } as never;

    // When
    const result = await setGoogleBusinessProfileNotificationParticipationForClient({
      restaurantId: 'restaurant-1',
      enabled: false,
      managedTopic: 'projects/project-1/topics/gbp',
      client,
    });

    // Then
    expect(result).toEqual({ enabled: false, refCount: 0 });
    expect(disableParticipationMock).toHaveBeenCalledTimes(1);
    expect(enableParticipationMock).not.toHaveBeenCalled();
  });

  it('maps an account topic conflict to the safe provider error contract', async () => {
    // Given
    enableParticipationMock.mockRejectedValue(new GoogleNotificationTopicConflictError());

    // When
    const result = setGoogleBusinessProfileNotificationParticipationForClient({
      restaurantId: 'restaurant-1',
      enabled: true,
      managedTopic: 'projects/project-1/topics/gbp',
      client: { kind: 'db' } as never,
    });

    // Then
    await expect(result).rejects.toMatchObject({
      code: 'GBP_NOTIFICATION_TOPIC_CONFLICT',
      status: 409,
    });
  });
});
