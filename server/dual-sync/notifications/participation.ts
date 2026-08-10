import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const MANAGED_EVENT_TYPE = 'GOOGLE_UPDATE';

export class GoogleNotificationTopicConflictError extends Error {
  constructor() {
    super('Google notification topic conflicts with the managed topic.');
    this.name = 'GoogleNotificationTopicConflictError';
  }
}

export interface GoogleAccountNotificationPort {
  read(accountId: string): Promise<{
    readonly topic: string | null;
    readonly eventTypes: readonly string[];
  }>;
  write(input: {
    readonly accountId: string;
    readonly topic: string | null;
    readonly eventTypes: readonly string[];
  }): Promise<void>;
}

export interface GoogleNotificationRegistryPort {
  attach(fence: GoogleNotificationParticipationFence): Promise<{ readonly refCount: number }>;
  detach(fence: GoogleNotificationParticipationFence): Promise<{ readonly refCount: number }>;
}

export type GoogleNotificationParticipationFence = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly externalAccountId: string;
  readonly externalProfileId: string;
  readonly externalLocationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

type ParticipationInput = {
  readonly fence: GoogleNotificationParticipationFence;
  readonly managedTopic: string;
  readonly provider: GoogleAccountNotificationPort;
  readonly registry: GoogleNotificationRegistryPort;
};

function assertManagedTopic(topic: string | null, managedTopic: string): void {
  if (topic && topic !== managedTopic) throw new GoogleNotificationTopicConflictError();
}

export async function enableGoogleUpdateParticipation(
  input: ParticipationInput,
): Promise<{ readonly refCount: number }> {
  const current = await input.provider.read(input.fence.externalAccountId);
  assertManagedTopic(current.topic, input.managedTopic);
  const eventTypes = [...new Set([...current.eventTypes, MANAGED_EVENT_TYPE])].sort();
  await input.provider.write({
    accountId: input.fence.externalAccountId,
    topic: input.managedTopic,
    eventTypes,
  });
  return input.registry.attach(input.fence);
}

export async function disableGoogleUpdateParticipation(
  input: ParticipationInput,
): Promise<{ readonly refCount: number }> {
  const detached = await input.registry.detach(input.fence);
  if (detached.refCount > 0) return detached;
  const current = await input.provider.read(input.fence.externalAccountId);
  assertManagedTopic(current.topic, input.managedTopic);
  const eventTypes = [...new Set(current.eventTypes)]
    .filter((eventType) => eventType !== MANAGED_EVENT_TYPE)
    .sort();
  await input.provider.write({
    accountId: input.fence.externalAccountId,
    topic: eventTypes.length > 0 ? input.managedTopic : null,
    eventTypes,
  });
  return detached;
}

export function createSupabaseGoogleNotificationRegistry(input: {
  readonly client: SupabaseClient<Database>;
  readonly managedTopic: string;
  readonly providerNotificationSettingId?: string | null;
}): GoogleNotificationRegistryPort {
  return {
    async attach(fence) {
      const result = await input.client.rpc('link_gbp_notification_participation_v1', {
        p_restaurant_id: fence.restaurantId,
        p_external_profile_row_id: fence.externalProfileRowId,
        p_external_account_id: fence.externalAccountId,
        p_external_profile_id: fence.externalProfileId,
        p_external_location_id: fence.externalLocationId,
        p_connection_generation: fence.connectionGeneration,
        p_consent_epoch: fence.consentEpoch,
        p_managed_topic: input.managedTopic,
        p_provider_notification_setting_id: input.providerNotificationSettingId ?? null,
      });
      if (result.error) throw result.error;
      return { refCount: result.data.ref_count };
    },
    async detach(fence) {
      const result = await input.client.rpc('unlink_gbp_notification_participation_v1', {
        p_restaurant_id: fence.restaurantId,
        p_external_profile_row_id: fence.externalProfileRowId,
        p_external_account_id: fence.externalAccountId,
        p_external_profile_id: fence.externalProfileId,
        p_external_location_id: fence.externalLocationId,
        p_connection_generation: fence.connectionGeneration,
        p_consent_epoch: fence.consentEpoch,
      });
      if (result.error) throw result.error;
      return { refCount: result.data.ref_count };
    },
  };
}

type GoogleNotificationReconciliationClient = {
  readonly get: (accountId: string) => Promise<{
    readonly pubsubTopic?: string;
    readonly notificationTypes?: readonly string[];
  }>;
  readonly reconcile: (input: {
    readonly accountId: string;
    readonly managedTopic: string | null;
    readonly finalNotificationTypes: readonly string[];
  }) => Promise<unknown>;
};

export function createGoogleAccountNotificationPort(
  client: GoogleNotificationReconciliationClient,
): GoogleAccountNotificationPort {
  return {
    async read(accountId) {
      const setting = await client.get(accountId);
      return {
        topic: setting.pubsubTopic ?? null,
        eventTypes: setting.notificationTypes ?? [],
      };
    },
    async write(input) {
      await client.reconcile({
        accountId: input.accountId,
        managedTopic: input.topic,
        finalNotificationTypes: input.eventTypes,
      });
    },
  };
}
