/**
 * Phase 3p of the unified dual-sync engine.
 *
 * Public surface for the notifications port + composition helpers.
 */

import { env } from '@/lib/env';

import { createConsoleNotificationPort } from './console';
import { createWebhookNotificationPort } from './webhook';

import type { DualSyncNotificationEvent, DualSyncNotificationPort } from './types';

export type {
  DualSyncNotificationEvent,
  DualSyncNotificationDeliveryResult,
  DualSyncNotificationKind,
  DualSyncNotificationPort,
  DualSyncNotificationSeverity,
} from './types';
export { createConsoleNotificationPort } from './console';
export { createWebhookNotificationPort } from './webhook';
export {
  buildGoogleWriteTerminalNotice,
  createSupabaseGoogleWriteTerminalNoticePersistence,
  deliverClaimedGoogleWriteNotices,
  emitOverdueGoogleWriteNotice,
  getGoogleWriteTerminalNoticeCensus,
  materializeGoogleWriteTerminalNotice,
  reconcileGoogleWriteTerminalNotices,
  terminalNoticeSla,
  type GoogleWriteTerminalNotice,
  type GoogleWriteTerminalNoticePersistencePort,
} from './terminal';
export {
  createGoogleAccountNotificationPort,
  createSupabaseGoogleNotificationRegistry,
  disableGoogleUpdateParticipation,
  enableGoogleUpdateParticipation,
  GoogleNotificationTopicConflictError,
  type GoogleAccountNotificationPort,
  type GoogleNotificationParticipationFence,
  type GoogleNotificationRegistryPort,
} from './participation';

/**
 * Compose multiple ports into one. The composed port emits to each
 * configured port in parallel and preserves the least-certain outcome.
 */
export function combineNotificationPorts(
  ports: ReadonlyArray<DualSyncNotificationPort>,
): DualSyncNotificationPort {
  if (ports.length === 0) {
    return {
      async emit() {
        return {
          outcome: 'definitive_rejection' as const,
          retryable: false,
          safeErrorCode: 'notification_transport_unavailable',
        };
      },
    };
  }
  if (ports.length === 1) {
    return ports[0]!;
  }
  return {
    async emit(event: DualSyncNotificationEvent) {
      const results = await Promise.all(
        ports.map(async (port) => {
          try {
            return await port.emit(event);
          } catch {
            return {
              outcome: 'ambiguous_failure' as const,
              safeErrorCode: 'notification_delivery_ambiguous',
            };
          }
        }),
      );
      const ambiguous = results.find((result) => result.outcome === 'ambiguous_failure');
      if (ambiguous) return ambiguous;
      const rejected = results.find((result) => result.outcome === 'definitive_rejection');
      return rejected ?? { outcome: 'confirmed_success' as const };
    },
  };
}

export interface BuildDefaultNotificationPortOptions {
  /**
   * Optional override for the webhook URL. Defaults to
   * the validated `DUAL_SYNC_FAILURE_WEBHOOK_URL` env entry.
   */
  readonly webhookUrl?: string | null;
  readonly headers?: Readonly<Record<string, string>>;
  readonly consolePort?: DualSyncNotificationPort;
}

/**
 * The deployment-default port. Always logs to console; if a webhook URL
 * is configured (env or option), also posts to that URL.
 */
export function buildDefaultNotificationPort(
  options: BuildDefaultNotificationPortOptions = {},
): DualSyncNotificationPort {
  const url = options.webhookUrl ?? env.dualSync.failureWebhookUrl;
  const console_ = options.consolePort ?? createConsoleNotificationPort();
  if (!url) return console_;
  const webhook = createWebhookNotificationPort({
    url,
    headers: options.headers,
    onError: () => {
      // Surface webhook transport failures via the console port so they
      // appear in the same logs operators already watch.
      void console_.emit({
        kind: 'cron_run_failed',
        severity: 'error',
        summary: 'Dual-sync webhook notification transport failed.',
        errorCode: 'webhook_transport_failed',
      });
    },
  });
  return combineNotificationPorts([console_, webhook]);
}
