import {
  createGoogleAccountNotificationPort,
  createSupabaseGoogleNotificationRegistry,
  disableGoogleUpdateParticipation,
  enableGoogleUpdateParticipation,
  GoogleNotificationTopicConflictError,
} from '@/server/dual-sync/notifications';

import { requireGoogleBusinessProfileContentFence } from './contentSnapshotPersistence';
import { GoogleBusinessProfileError } from './errors';
import { createGoogleNotificationAdministrationClient } from './notificationClient';
import { getUsableGoogleBusinessProfileAccessToken } from './serviceAccessRuntime';
import { ensureExternalProfile } from './serviceRepository';

import type { DbClient } from './serviceRepository';

export interface GoogleBusinessProfileNotificationParticipationResult {
  readonly enabled: boolean;
  readonly refCount: number;
}

export async function setGoogleBusinessProfileNotificationParticipationForClient(params: {
  readonly restaurantId: string;
  readonly enabled: boolean;
  readonly managedTopic: string;
  readonly client: DbClient;
}): Promise<GoogleBusinessProfileNotificationParticipationResult> {
  const profile = await ensureExternalProfile(params.restaurantId, params.client);
  const fence = requireGoogleBusinessProfileContentFence(params.restaurantId, profile);
  const { accessToken } = await getUsableGoogleBusinessProfileAccessToken(profile, params.client);
  const notificationClient = createGoogleNotificationAdministrationClient({ accessToken });
  const input = {
    fence,
    managedTopic: params.managedTopic,
    provider: createGoogleAccountNotificationPort(notificationClient),
    registry: createSupabaseGoogleNotificationRegistry({
      client: params.client,
      managedTopic: params.managedTopic,
    }),
  };
  try {
    const result = params.enabled
      ? await enableGoogleUpdateParticipation(input)
      : await disableGoogleUpdateParticipation(input);
    return { enabled: params.enabled, refCount: result.refCount };
  } catch (error) {
    if (error instanceof GoogleNotificationTopicConflictError) {
      throw new GoogleBusinessProfileError(
        'The Google account is already managed by a conflicting notification topic.',
        { code: 'GBP_NOTIFICATION_TOPIC_CONFLICT', status: 409 },
      );
    }
    throw error;
  }
}
