'use client';

import {
  useMutation,
  useMutationState,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/lib/query/keys';
import { useEmailDeliveryTransport } from '@src/hooks/ops/emailDeliveryTransport';

import type { HttpError } from '@/lib/http/errors';
import type {
  EmailDeliveryRetryResponse,
  EmailQueueJobActionResponse,
} from '@/services/ops/email-delivery';

export type RetryEmailDeliveryVariables = {
  restaurantId: string;
  deliveryLogId: string;
  /** The booking whose email log also shows this email (narrow invalidation). */
  bookingId: string | null;
  /** Display only: used in the success toast. */
  recipientEmail: string;
  simulateError?: boolean;
};

export type EmailQueueJobVariables = { restaurantId: string; jobId: string };

const RETRY_ERROR_COPY: Partial<Record<string, string>> = {
  RETRY_IN_PROGRESS: 'This email is already being resent. Refresh in a moment to see the result.',
  ALREADY_RETRIED: 'This email was already resent. Refresh to see the new attempt.',
  NOT_RETRYABLE: 'Only failed or bounced emails can be resent.',
  RECIPIENT_SUPPRESSED: 'Not sent: this address is blocked after a bounce or complaint.',
  MISSING_RECIPIENT: 'Not sent: the booking has no email address.',
  MISSING_BOOKING: 'Not sent: the booking for this email no longer exists.',
  SEND_FAILED: "Failed: the email couldn't be sent. Try again in a moment.",
  SEND_UNCONFIRMED:
    "Failed: the email provider didn't confirm the send. Retrying is safe and won't send a duplicate.",
  RATE_LIMITED: 'Too many resend attempts. Wait a minute and try again.',
};

const QUEUE_ERROR_COPY: Partial<Record<string, string>> = {
  JOB_IN_PROGRESS: 'This email is being sent right now, so it can no longer be cancelled.',
  JOB_NOT_CANCELLABLE: 'This email has already been sent or cancelled.',
  NOT_REQUEUEABLE: 'Only failed emails can be requeued.',
  NOT_FOUND: 'That email job no longer exists. Refresh the queue.',
};

/**
 * Synchronous manual resend of a failed or bounced email. The server claims the entry
 * atomically, so a double click or a second tab gets RETRY_IN_PROGRESS instead of a second send.
 */
export function useRetryEmailDelivery(): UseMutationResult<
  EmailDeliveryRetryResponse,
  HttpError | Error,
  RetryEmailDeliveryVariables
> {
  const transport = useEmailDeliveryTransport();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.opsEmailDeliveryMutations.retry(),
    retry: false,
    mutationFn: ({ restaurantId, deliveryLogId, simulateError }) =>
      transport.retryEmailDelivery({ restaurantId, deliveryLogId, simulateError }),
    onSettled: async (_data, _error, variables) => {
      // A conflict or lost response can still mean a send happened. Reconcile every affected view.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.opsEmailDelivery.feedPrefix(variables.restaurantId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.opsEmailDelivery.summaryPrefix(variables.restaurantId),
        }),
        variables.bookingId
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.opsEmailDelivery.bookingLogPrefix(variables.bookingId),
            })
          : Promise.resolve(),
      ]);
    },
    meta: {
      feedback: {
        success: (_data, variables) =>
          `Sent: the email was resent to ${(variables as RetryEmailDeliveryVariables).recipientEmail}.`,
        error: { copy: RETRY_ERROR_COPY, fallback: "Failed: the email couldn't be resent." },
      },
    },
  });
}

function useQueueJobMutation<TAction extends 'cancelled' | 'requeued'>(options: {
  mutationKey: readonly unknown[];
  run: (variables: EmailQueueJobVariables) => Promise<EmailQueueJobActionResponse<TAction>>;
  successMessage: string;
  fallback: string;
}): UseMutationResult<
  EmailQueueJobActionResponse<TAction>,
  HttpError | Error,
  EmailQueueJobVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: options.mutationKey,
    mutationFn: options.run,
    retry: false,
    // Only this restaurant's queue changed (the delivery log gains rows only once it sends).
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.opsEmailQueue.feedPrefix(variables.restaurantId),
      });
    },
    meta: {
      feedback: {
        success: options.successMessage,
        error: { copy: QUEUE_ERROR_COPY, fallback: options.fallback },
      },
    },
  });
}

export function useCancelEmailQueueJob() {
  const transport = useEmailDeliveryTransport();
  return useQueueJobMutation({
    mutationKey: queryKeys.opsEmailDeliveryMutations.cancelQueueJob(),
    run: (variables) => transport.cancelEmailQueueJob(variables),
    successMessage: 'Scheduled email cancelled.',
    fallback: "The scheduled email couldn't be cancelled.",
  });
}

export function useRequeueEmailQueueJob() {
  const transport = useEmailDeliveryTransport();
  return useQueueJobMutation({
    mutationKey: queryKeys.opsEmailDeliveryMutations.requeueQueueJob(),
    run: (variables) => transport.requeueEmailQueueJob(variables),
    successMessage: 'Email requeued. It sends on the next queue run.',
    fallback: "The email couldn't be requeued.",
  });
}

/** Ids of rows with a mutation in flight, so each row shows its own pending state. */
export function usePendingEmailDeliveryIds(): {
  retryingDeliveryLogIds: ReadonlySet<string>;
  pendingQueueJobIds: ReadonlySet<string>;
} {
  const retrying = useMutationState({
    filters: { mutationKey: queryKeys.opsEmailDeliveryMutations.retry(), status: 'pending' },
    select: (mutation) => (mutation.state.variables as RetryEmailDeliveryVariables).deliveryLogId,
  });
  const cancelling = useMutationState({
    filters: {
      mutationKey: queryKeys.opsEmailDeliveryMutations.cancelQueueJob(),
      status: 'pending',
    },
    select: (mutation) => (mutation.state.variables as EmailQueueJobVariables).jobId,
  });
  const requeueing = useMutationState({
    filters: {
      mutationKey: queryKeys.opsEmailDeliveryMutations.requeueQueueJob(),
      status: 'pending',
    },
    select: (mutation) => (mutation.state.variables as EmailQueueJobVariables).jobId,
  });

  const retryKey = retrying.join('\u0000');
  const queueKey = [...cancelling, ...requeueing].join('\u0000');
  const retryingDeliveryLogIds = useMemo(
    () => new Set(retryKey ? retryKey.split('\u0000') : []),
    [retryKey],
  );
  const pendingQueueJobIds = useMemo(
    () => new Set(queueKey ? queueKey.split('\u0000') : []),
    [queueKey],
  );

  return { retryingDeliveryLogIds, pendingQueueJobIds };
}
