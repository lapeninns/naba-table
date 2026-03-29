'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { HttpError } from '@/lib/http/errors';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { BookingService } from '@/services/ops/bookings';

export function useOpsEmailDeliveryRetryState(params: {
  bookingService: BookingService;
  rowByKey: Map<string, OpsEmailDeliveryTableRowViewModel>;
  refetch: () => Promise<unknown>;
  simulateRetryMutationError: boolean;
}) {
  const [pendingRetryAttemptKey, setPendingRetryAttemptKey] = useState<string | null>(null);
  const [retryingAttemptKey, setRetryingAttemptKey] = useState<string | null>(null);

  const pendingRetryRow = useMemo(
    () => (pendingRetryAttemptKey ? params.rowByKey.get(pendingRetryAttemptKey) ?? null : null),
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

    setRetryingAttemptKey(pendingRetryRow.attemptKey);

    try {
      await params.bookingService.retryEmailDelivery({
        deliveryLogId: pendingRetryRow.attempt.id ?? pendingRetryRow.attempt.messageId,
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
