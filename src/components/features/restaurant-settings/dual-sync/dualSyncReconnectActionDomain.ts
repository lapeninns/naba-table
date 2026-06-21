import type { DualSyncToastIntent } from './dualSyncShellActionDomain';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export function isDualSyncReconnectRequired(
  connection: GoogleBusinessProfileConnection | null | undefined,
): boolean {
  return connection?.status === 'reauth_required';
}

export function getDualSyncReconnectErrorToastIntent(error: unknown): DualSyncToastIntent {
  return {
    kind: 'error',
    message: error instanceof Error ? error.message : 'Google reconnect failed.',
  };
}
