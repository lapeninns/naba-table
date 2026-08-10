import { GoogleBusinessProfileError } from './errors';

export type GoogleConnectionFence = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly accountId: string | null;
  readonly profileId: string | null;
  readonly locationId: string | null;
  readonly actorUserId: string;
};

export type GoogleConnectionLifecycleStore = {
  readonly transition: (
    fence: GoogleConnectionFence,
    nextState: 'blocked' | 'revoking' | 'disconnected' | 'reauth_required',
    reasonCode: string,
  ) => Promise<void>;
  readonly retainRestrictedRevocationCredential: (fence: GoogleConnectionFence) => Promise<void>;
  readonly purgeDisconnectedProviderData: (fence: GoogleConnectionFence) => Promise<void>;
};

export type GoogleDisconnectHooks = {
  readonly teardownNotifications: (fence: GoogleConnectionFence) => Promise<void>;
  readonly revokeToken: () => Promise<void>;
};

export async function transitionForGoogleProviderError(
  error: unknown,
  fence: GoogleConnectionFence,
  store: GoogleConnectionLifecycleStore,
): Promise<void> {
  if (!(error instanceof GoogleBusinessProfileError)) return;
  if (error.kind === 'reauth' || error.code === 'GBP_REAUTH_REQUIRED') {
    await store.transition(fence, 'reauth_required', 'provider_reauth_required');
    return;
  }
  if (error.kind === 'access_lost') {
    await store.transition(fence, 'blocked', 'provider_access_lost');
  }
}

export async function disableGoogleConnection(
  fence: GoogleConnectionFence,
  store: GoogleConnectionLifecycleStore,
): Promise<void> {
  await store.transition(fence, 'blocked', 'operator_disabled');
}

export async function disconnectGoogleConnection(
  fence: GoogleConnectionFence,
  store: GoogleConnectionLifecycleStore,
  hooks: GoogleDisconnectHooks,
): Promise<{ readonly revocationCertain: boolean }> {
  await store.transition(fence, 'revoking', 'operator_disconnect');
  await hooks.teardownNotifications(fence);
  try {
    await hooks.revokeToken();
  } catch (error) {
    if (error instanceof Error) {
      await store.retainRestrictedRevocationCredential(fence);
      return { revocationCertain: false };
    }
    throw error;
  }
  await store.transition(fence, 'disconnected', 'provider_revoked');
  await store.purgeDisconnectedProviderData(fence);
  return { revocationCertain: true };
}
