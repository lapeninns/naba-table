import { describe, expect, it } from 'vitest';

import {
  getDualSyncReconnectErrorToastIntent,
  isDualSyncReconnectRequired,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncReconnectActionDomain';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

function connection(
  status: GoogleBusinessProfileConnection['status'],
): GoogleBusinessProfileConnection {
  return {
    status,
  } as GoogleBusinessProfileConnection;
}

describe('dualSyncReconnectActionDomain', () => {
  it('detects reauthorization-required GBP connection state', () => {
    expect(isDualSyncReconnectRequired(connection('reauth_required'))).toBe(true);
    expect(isDualSyncReconnectRequired(connection('linked'))).toBe(false);
    expect(isDualSyncReconnectRequired(undefined)).toBe(false);
  });

  it('builds reconnect error toast intents', () => {
    expect(getDualSyncReconnectErrorToastIntent(new Error('Reconnect failed'))).toEqual({
      kind: 'error',
      message: 'Google reconnect failed. Reason code: unknown_error.',
    });
    expect(getDualSyncReconnectErrorToastIntent('unknown')).toEqual({
      kind: 'error',
      message: 'Google reconnect failed. Reason code: unknown_error.',
    });
  });
});
