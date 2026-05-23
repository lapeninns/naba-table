'use client';

import { useCallback } from 'react';

import {
  useOpsGoogleBusinessProfileConnection,
  useOpsStartGoogleBusinessProfileAuthorization,
} from '@/hooks/ops/useOpsGoogleBusinessProfile';

import {
  getDualSyncReconnectErrorToastIntent,
  isDualSyncReconnectRequired,
} from '../dualSyncReconnectActionDomain';
import { useDualSyncToastBridge } from './useDualSyncToastBridge';

interface UseDualSyncReconnectActionArgs {
  readonly restaurantId: string;
  readonly redirectToAuthorizationUrl?: (authorizationUrl: string) => void;
}

function redirectWindowLocation(authorizationUrl: string) {
  window.location.assign(authorizationUrl);
}

export function useDualSyncReconnectAction({
  restaurantId,
  redirectToAuthorizationUrl = redirectWindowLocation,
}: UseDualSyncReconnectActionArgs) {
  const connectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const startAuthMutation = useOpsStartGoogleBusinessProfileAuthorization(restaurantId);
  const showToast = useDualSyncToastBridge();
  const isReconnectPending = startAuthMutation.isPending;
  const startAuthorization = startAuthMutation.mutate;
  const needsReauth = isDualSyncReconnectRequired(connectionQuery.data);

  const handleReconnect = useCallback(() => {
    if (isReconnectPending) {
      return;
    }
    startAuthorization(undefined, {
      onSuccess: ({ authorizationUrl }) => {
        redirectToAuthorizationUrl(authorizationUrl);
      },
      onError: (err) => {
        showToast(getDualSyncReconnectErrorToastIntent(err));
      },
    });
  }, [isReconnectPending, redirectToAuthorizationUrl, showToast, startAuthorization]);

  return {
    handleReconnect,
    isReconnectPending,
    needsReauth,
  };
}
