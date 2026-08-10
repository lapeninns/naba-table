/**
 * Phase 3p of the unified dual-sync engine.
 *
 * Webhook `DualSyncNotificationPort` that POSTs each event as JSON to a
 * configured URL. Useful for routing failures to Slack incoming
 * webhooks, PagerDuty events API, or a custom collector.
 *
 * The port intentionally:
 *  - returns a typed, persistence-ready outcome for every attempt
 *  - applies a 5s timeout so a hung webhook cannot stall the loop
 *  - sends a slim payload (fields known on `DualSyncNotificationEvent`)
 */

import type {
  DualSyncNotificationDeliveryResult,
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
    async emit(event: DualSyncNotificationEvent): Promise<DualSyncNotificationDeliveryResult> {
      if (typeof fetchImpl !== 'function') {
        return {
          outcome: 'definitive_rejection',
          retryable: false,
          safeErrorCode: 'webhook_transport_unavailable',
        };
      }
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
        if (res.ok) return { outcome: 'confirmed_success' };
        const error = new Error(`Webhook responded ${res.status} for ${event.kind}`);
        if (options.onError) options.onError(error);
        if (res.status === 425 || res.status === 429) {
          return {
            outcome: 'definitive_rejection',
            retryable: true,
            safeErrorCode: `webhook_retryable_${res.status}`,
          };
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 408) {
          return {
            outcome: 'definitive_rejection',
            retryable: false,
            safeErrorCode: `webhook_rejected_${res.status}`,
          };
        }
        return { outcome: 'ambiguous_failure', safeErrorCode: 'webhook_delivery_ambiguous' };
      } catch (error) {
        if (options.onError) options.onError(error);
        return { outcome: 'ambiguous_failure', safeErrorCode: 'webhook_delivery_ambiguous' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
