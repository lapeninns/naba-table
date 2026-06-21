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
  DualSyncNotificationKind,
  DualSyncNotificationPort,
  DualSyncNotificationSeverity,
} from './types';
export { createConsoleNotificationPort } from './console';
export { createWebhookNotificationPort } from './webhook';

/**
 * Compose multiple ports into one. The composed port emits to each
 * configured port in parallel and never throws.
 */
export function combineNotificationPorts(
  ports: ReadonlyArray<DualSyncNotificationPort>,
): DualSyncNotificationPort {
  if (ports.length === 0) {
    return { async emit() {} };
  }
  if (ports.length === 1) {
    return ports[0]!;
  }
  return {
    async emit(event: DualSyncNotificationEvent): Promise<void> {
      await Promise.all(
        ports.map(async (port) => {
          try {
            await port.emit(event);
          } catch {
            // never throw
          }
        }),
      );
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
}

/**
 * The deployment-default port. Always logs to console; if a webhook URL
 * is configured (env or option), also posts to that URL.
 */
export function buildDefaultNotificationPort(
  options: BuildDefaultNotificationPortOptions = {},
): DualSyncNotificationPort {
  const url = options.webhookUrl ?? env.dualSync.failureWebhookUrl;
  const console_ = createConsoleNotificationPort();
  if (!url) return console_;
  const webhook = createWebhookNotificationPort({
    url,
    headers: options.headers,
    onError: (error) => {
      // Surface webhook transport failures via the console port so they
      // appear in the same logs operators already watch.
      const message = error instanceof Error ? error.message : 'Unknown webhook transport error';
      console.warn('[dual-sync:webhook-transport]', message);
    },
  });
  return combineNotificationPorts([console_, webhook]);
}
