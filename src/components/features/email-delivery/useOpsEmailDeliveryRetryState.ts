'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { track } from '@/lib/analytics';
import { HttpError } from '@/lib/http/errors';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { BookingService } from '@/services/ops/bookings';
import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function parseEventTime(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function resolveRetryDeliveryLogId(attempt: OpsEmailDeliveryAttemptDTO): string | null {
  const directId = typeof attempt.id === 'string' ? attempt.id.trim() : '';
  if (directId) return directId;

  const currentEvent = attempt.events
    .slice()
    .sort(
      (left, right) =>
        parseEventTime(right.occurredAt) - parseEventTime(left.occurredAt) ||
        right.id.localeCompare(left.id),
    )
    .find(
      (event) =>
        event.status === attempt.currentStatus &&
        (!attempt.currentOccurredAt || event.occurredAt === attempt.currentOccurredAt),
    );

  const eventId = currentEvent?.id.trim() ?? '';
  return eventId || null;
}

export function useOpsEmailDeliveryRetryState(params: {
  bookingService: BookingService;
  rowByKey: Map<string, OpsEmailDeliveryTableRowViewModel>;
  refetch: () => Promise<unknown>;
  simulateRetryMutationError: boolean;
}) {
  const [pendingRetryAttemptKey, setPendingRetryAttemptKey] = useState<string | null>(null);
  const [retryingAttemptKey, setRetryingAttemptKey] = useState<string | null>(null);

  const pendingRetryRow = useMemo(
    () => (pendingRetryAttemptKey ? (params.rowByKey.get(pendingRetryAttemptKey) ?? null) : null),
    [params.rowByKey, pendingRetryAttemptKey],
  );

  const handleRetryAttempt = useCallback((attemptKey: string) => {
    setPendingRetryAttemptKey(attemptKey);
  }, []);

  const handleRetryDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !retryingAttemptKey) {
        setPendingRetryAttemptKey(null);
      }
    },
    [retryingAttemptKey],
  );

  const handleConfirmRetry = useCallback(async () => {
    if (!pendingRetryRow) return;

    const deliveryLogId = resolveRetryDeliveryLogId(pendingRetryRow.attempt);
    if (!deliveryLogId) {
      setPendingRetryAttemptKey(null);
      toast.error('Retry unavailable', {
        description: 'This email attempt is missing its delivery log id. Refresh and try again.',
      });
      return;
    }

    setRetryingAttemptKey(pendingRetryRow.attemptKey);
    track('email_delivery_retry_clicked', { provider: 'resend', source: 'ops' });

    try {
      await params.bookingService.retryEmailDelivery({
        deliveryLogId,
        ...(params.simulateRetryMutationError ? { simulateError: true } : {}),
      });

      toast.success('Retry queued', {
        description: `Resending ${pendingRetryRow.attempt.emailType ?? 'email'} to ${pendingRetryRow.recipientEmail}.`,
      });

      setPendingRetryAttemptKey(null);
      await params.refetch();
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to retry email delivery';

      setPendingRetryAttemptKey(null);
      track('email_delivery_retry_failed', { provider: 'resend', source: 'ops' });
      toast.error('Retry failed', { description: message });
    } finally {
      setRetryingAttemptKey(null);
    }
  }, [params, pendingRetryRow]);

  return {
    pendingRetryAttemptKey,
    pendingRetryRow,
    retryingAttemptKey,
    handleRetryAttempt,
    handleRetryDialogOpenChange,
    handleConfirmRetry,
  };
}
