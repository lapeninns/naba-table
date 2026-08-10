import { createGoogleJsonTransport, type GoogleTransportDependencies } from './clientTransport';
import { GoogleBusinessProfileError } from './errors';
import { googleNotificationSettingSchema } from './providerSchemas';

const NOTIFICATIONS_ORIGIN = 'https://mybusinessnotifications.googleapis.com';

type GoogleNotificationSetting = {
  readonly name?: string;
  readonly pubsubTopic?: string;
  readonly notificationTypes?: readonly string[];
};

export type GoogleNotificationAdministrationClient = {
  readonly mutationScope: 'account_administration';
  readonly requiresListingWritePermit: false;
  readonly get: (accountId: string) => Promise<GoogleNotificationSetting>;
  readonly update: (params: {
    readonly accountId: string;
    readonly managedTopic: string;
    readonly managedNotificationTypes: readonly string[];
  }) => Promise<GoogleNotificationSetting>;
  readonly reconcile: (params: {
    readonly accountId: string;
    readonly managedTopic: string | null;
    readonly finalNotificationTypes: readonly string[];
  }) => Promise<GoogleNotificationSetting>;
};

export function createGoogleNotificationAdministrationClient(config: {
  readonly accessToken: string;
  readonly quotaProject?: string | null;
  readonly dependencies?: GoogleTransportDependencies;
}): GoogleNotificationAdministrationClient {
  const transport = createGoogleJsonTransport({
    origin: NOTIFICATIONS_ORIGIN,
    accessToken: config.accessToken,
    quotaProject: config.quotaProject,
    ...config.dependencies,
  });
  const patch = (
    accountId: string,
    managedTopic: string | null,
    notificationTypes: readonly string[],
  ) =>
    transport.request(
      `v1/accounts/${encodeURIComponent(accountId)}/notificationSetting`,
      googleNotificationSettingSchema,
      {
        method: 'PATCH',
        retry: false,
        searchParams: { updateMask: 'pubsubTopic,notificationTypes' },
        json: {
          pubsubTopic: managedTopic ?? '',
          notificationTypes: [...new Set(notificationTypes)].sort(),
        },
      },
    );
  return {
    mutationScope: 'account_administration',
    requiresListingWritePermit: false,
    get(accountId: string) {
      return transport.request(
        `v1/accounts/${encodeURIComponent(accountId)}/notificationSetting`,
        googleNotificationSettingSchema,
        { retry: false },
      );
    },
    async update(params: {
      readonly accountId: string;
      readonly managedTopic: string;
      readonly managedNotificationTypes: readonly string[];
    }) {
      const current = await this.get(params.accountId);
      if (current.pubsubTopic && current.pubsubTopic !== params.managedTopic) {
        throw new GoogleBusinessProfileError(
          'The Google account is already managed by a conflicting notification topic.',
          { code: 'GBP_NOTIFICATION_TOPIC_CONFLICT', status: 409 },
        );
      }
      const notificationTypes = [
        ...new Set([...(current.notificationTypes ?? []), ...params.managedNotificationTypes]),
      ].sort();
      return patch(params.accountId, params.managedTopic, notificationTypes);
    },
    async reconcile(params: {
      readonly accountId: string;
      readonly managedTopic: string | null;
      readonly finalNotificationTypes: readonly string[];
    }) {
      if (params.managedTopic === null && params.finalNotificationTypes.length > 0) {
        throw new GoogleBusinessProfileError(
          'A notification topic is required while account notifications remain enabled.',
          { code: 'GBP_NOTIFICATION_TOPIC_REQUIRED', status: 409 },
        );
      }
      const current = await this.get(params.accountId);
      if (
        params.managedTopic !== null &&
        current.pubsubTopic &&
        current.pubsubTopic !== params.managedTopic
      ) {
        throw new GoogleBusinessProfileError(
          'The Google account is already managed by a conflicting notification topic.',
          { code: 'GBP_NOTIFICATION_TOPIC_CONFLICT', status: 409 },
        );
      }
      return patch(params.accountId, params.managedTopic, params.finalNotificationTypes);
    },
  };
}
