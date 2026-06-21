/**
 * Phase 3p of the unified dual-sync engine.
 *
 * Webhook `DualSyncNotificationPort` that POSTs each event as JSON to a
 * configured URL. Useful for routing failures to Slack incoming
 * webhooks, PagerDuty events API, or a custom collector.
 *
 * The port intentionally:
 *  - swallows transport errors (the cron must continue across tenants)
 *  - applies a 5s timeout so a hung webhook can't stall the loop
 *  - sends a slim payload (fields known on `DualSyncNotificationEvent`)
 */

import type {
  DualSyncNotificationEvent,
  DualSyncNotificationPort,
} from './types';

export interface CreateWebhookNotificationPortOptions {
  readonly url: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Extra headers (e.g. Bearer token, custom signing). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Hook to log transport failures. Should not throw. */
  readonly onError?: (error: unknown) => void;
}

export function createWebhookNotificationPort(
  options: CreateWebhookNotificationPortOptions,
): DualSyncNotificationPort {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5_000;

  return {
    async emit(event: DualSyncNotificationEvent): Promise<void> {
      if (typeof fetchImpl !== 'function') return;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, timeoutMs);
      try {
        const payload = {
          ...event,
          occurredAt: event.occurredAt ?? new Date().toISOString(),
        };
        const res = await fetchImpl(options.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(options.headers ?? {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok && options.onError) {
          options.onError(
            new Error(
              `Webhook responded ${res.status} for ${event.kind}`,
            ),
          );
        }
      } catch (error) {
        if (options.onError) options.onError(error);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
