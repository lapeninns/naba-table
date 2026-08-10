/**
 * Phase 3p of the unified dual-sync engine.
 *
 * Default `DualSyncNotificationPort` that emits to the console. Used in
 * test environments and as a baseline composed with the webhook port
 * when a webhook URL is configured.
 */

import type {
  DualSyncNotificationDeliveryResult,
  DualSyncNotificationEvent,
  DualSyncNotificationPort,
} from './types';

function defaultLevel(severity: DualSyncNotificationEvent['severity']) {
  switch (severity) {
    case 'error':
      return 'error' as const;
    case 'warning':
      return 'warn' as const;
    default:
      return 'info' as const;
  }
}

export interface CreateConsoleNotificationPortOptions {
  readonly logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export function createConsoleNotificationPort(
  options: CreateConsoleNotificationPortOptions = {},
): DualSyncNotificationPort {
  const logger = options.logger ?? console;
  return {
    async emit(event: DualSyncNotificationEvent): Promise<DualSyncNotificationDeliveryResult> {
      try {
        const payload = {
          ...event,
          occurredAt: event.occurredAt ?? new Date().toISOString(),
        };
        const level = defaultLevel(event.severity);
        const prefix = `[dual-sync:${event.kind}]`;
        if (level === 'error') {
          logger.error(prefix, payload);
        } else if (level === 'warn') {
          logger.warn(prefix, payload);
        } else {
          logger.info(prefix, payload);
        }
        return { outcome: 'confirmed_success' };
      } catch {
        return { outcome: 'ambiguous_failure', safeErrorCode: 'console_delivery_failed' };
      }
    },
  };
}
