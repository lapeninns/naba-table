import { fetchJson } from '@/lib/http/fetchJson';

import type { BookingService } from './bookings';

/**
 * Standalone email-delivery mutation calls (manual resend, queue cancel/requeue). They replace
 * the `BookingService` methods for the email delivery page; `BookingService` (owned elsewhere)
 * keeps its methods until they are removed.
 */
export type EmailDeliveryRetryInput = {
  restaurantId: string;
  deliveryLogId: string;
  simulateError?: boolean;
};

/** A synchronous resend: `status: 'sent'` means the provider accepted the new email. */
export type EmailDeliveryRetryResponse = {
  ok: true;
  status: 'sent';
  retryAttempt: number;
  /** The new delivery-log row, or null when the email was sent but could not be logged. */
  deliveryLogEntry: unknown;
};

export type EmailQueueJobInput = { restaurantId: string; jobId: string };

export type EmailQueueJobActionResponse<TAction extends 'cancelled' | 'requeued'> = {
  ok: true;
  jobId: string;
  action: TAction;
};

export type EmailDeliveryTransport = {
  retryEmailDelivery(input: EmailDeliveryRetryInput): Promise<EmailDeliveryRetryResponse>;
  cancelEmailQueueJob(input: EmailQueueJobInput): Promise<EmailQueueJobActionResponse<'cancelled'>>;
  requeueEmailQueueJob(input: EmailQueueJobInput): Promise<EmailQueueJobActionResponse<'requeued'>>;
};

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const httpEmailDeliveryTransport: EmailDeliveryTransport = {
  retryEmailDelivery({ restaurantId, deliveryLogId, simulateError }) {
    return postJson('/api/ops/email-delivery/retry', {
      restaurantId,
      deliveryLogId,
      ...(simulateError ? { simulateError: true } : {}),
    });
  },
  cancelEmailQueueJob({ restaurantId, jobId }) {
    return postJson(`/api/ops/email-queue/${encodeURIComponent(jobId)}/cancel`, { restaurantId });
  },
  requeueEmailQueueJob({ restaurantId, jobId }) {
    return postJson(`/api/ops/email-queue/${encodeURIComponent(jobId)}/requeue`, {
      restaurantId,
    });
  },
};

/** Adapts an injected `BookingService` (dev harness, tests) to the transport. */
export function emailDeliveryTransportFromService(
  service: Pick<
    BookingService,
    'retryEmailDelivery' | 'cancelEmailQueueJob' | 'requeueEmailQueueJob'
  >,
): EmailDeliveryTransport {
  return {
    async retryEmailDelivery(input) {
      const response = await service.retryEmailDelivery(input);
      return {
        ok: true,
        status: 'sent',
        retryAttempt: 1,
        deliveryLogEntry: response.deliveryLogEntry,
      };
    },
    cancelEmailQueueJob: (input) => service.cancelEmailQueueJob(input),
    requeueEmailQueueJob: (input) => service.requeueEmailQueueJob(input),
  };
}
