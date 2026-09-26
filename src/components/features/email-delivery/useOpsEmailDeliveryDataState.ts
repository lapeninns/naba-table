'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useOpsEmailDeliveryFeed } from '@/hooks/ops/useOpsEmailDeliveryFeed';
import { useOpsEmailDeliverySummary } from '@/hooks/ops/useOpsEmailDeliverySummary';
import { useOpsEmailQueueFeed } from '@/hooks/ops/useOpsEmailQueueFeed';
import { track } from '@/lib/analytics';
import {
  useCancelEmailQueueJob,
  usePendingEmailDeliveryIds,
  useRequeueEmailQueueJob,
  useRetryEmailDelivery,
} from '@src/hooks/ops/useOpsEmailDeliveryMutations';

import {
  getDeliveryFeedErrorMessage,
  getOpsEmailDeliveryRefreshIntervalMs,
  resolveRetryDeliveryLogId,
} from './opsEmailDeliveryDomain';
import { buildOpsEmailDeliveryTableRows } from './opsEmailDeliverySelectors';

import type {
  EmailDeliveryTab,
  OpsEmailDeliveryRefreshOption,
  OpsEmailDeliveryTableRowViewModel,
} from './opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';
import type { OpsEmailQueueJobStatus } from '@/types/emailQueue';

export function useOpsEmailDeliveryDataState(params: {
  restaurantId: string | null;
  activeTab: EmailDeliveryTab;
  range: OpsEmailDeliveryRange;
  page: number;
  pageSize: number;
  refresh: OpsEmailDeliveryRefreshOption;
  statuses: EmailDeliveryStatus[];
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
  templateType: string | null;
  emailType: string | null;
  timezone: string;
}) {
  const refreshIntervalMs = useMemo(
    () => getOpsEmailDeliveryRefreshIntervalMs(params.refresh),
    [params.refresh],
  );

  const [queueStatus, setQueueStatus] = useState<OpsEmailQueueJobStatus | 'all'>('all');
  const [queuePage, setQueuePage] = useState(1);
  const [pendingRetryAttemptKey, setPendingRetryAttemptKey] = useState<string | null>(null);
  const [pendingCancelJobId, setPendingCancelJobId] = useState<string | null>(null);

  const retryMutation = useRetryEmailDelivery();
  const cancelQueueJobMutation = useCancelEmailQueueJob();
  const requeueQueueJobMutation = useRequeueEmailQueueJob();
  const { retryingDeliveryLogIds, pendingQueueJobIds } = usePendingEmailDeliveryIds();

  useEffect(() => {
    setQueuePage(1);
    setQueueStatus('all');
    setPendingCancelJobId(null);
  }, [params.restaurantId]);

  const feedQuery = useOpsEmailDeliveryFeed({
    restaurantId: params.restaurantId,
    range: params.range,
    page: params.page,
    pageSize: params.pageSize,
    status: params.statuses.length > 0 ? params.statuses : undefined,
    refetchIntervalMs: params.activeTab === 'delivery-log' ? refreshIntervalMs : false,
    recipientEmail: params.recipientEmail ?? undefined,
    messageId: params.messageId ?? undefined,
    bookingRef: params.bookingRef ?? undefined,
    templateType: params.templateType ?? undefined,
    emailType: params.emailType ?? undefined,
  });

  const analyticsQuery = useOpsEmailDeliverySummary({
    restaurantId: params.restaurantId,
    range: params.range,
    refetchIntervalMs: params.activeTab === 'analytics' ? refreshIntervalMs : false,
    recipientEmail: params.recipientEmail ?? undefined,
    messageId: params.messageId ?? undefined,
    bookingRef: params.bookingRef ?? undefined,
    templateType: params.templateType ?? undefined,
    emailType: params.emailType ?? undefined,
  });

  const queueQuery = useOpsEmailQueueFeed({
    restaurantId: params.restaurantId,
    enabled: params.activeTab === 'queue',
    page: queuePage,
    pageSize: 25,
    status: queueStatus === 'all' ? undefined : queueStatus,
    refetchIntervalMs: params.activeTab === 'queue' ? refreshIntervalMs : false,
  });

  const attempts = useMemo(() => feedQuery.attempts ?? [], [feedQuery.attempts]);
  const rows = useMemo<OpsEmailDeliveryTableRowViewModel[]>(
    () => buildOpsEmailDeliveryTableRows({ attempts, timezone: params.timezone }),
    [attempts, params.timezone],
  );
  const rowByKey = useMemo(() => new Map(rows.map((row) => [row.attemptKey, row])), [rows]);
  const pendingRetryRow = useMemo(
    () => (pendingRetryAttemptKey ? (rowByKey.get(pendingRetryAttemptKey) ?? null) : null),
    [pendingRetryAttemptKey, rowByKey],
  );

  const statusCounts = useMemo(() => {
    const summary = feedQuery.summary;
    if (!summary) return null;
    return {
      sent: summary.sent,
      delivered: summary.delivered,
      delivery_delayed: summary.deliveryDelayed,
      bounced: summary.bounced,
      complained: summary.complained,
      failed: summary.failed,
    } satisfies Partial<Record<EmailDeliveryStatus, number>>;
  }, [feedQuery.summary]);

  const deliveryLogErrorMessage = feedQuery.apiError
    ? getDeliveryFeedErrorMessage(feedQuery.apiError)
    : feedQuery.error
      ? getDeliveryFeedErrorMessage(feedQuery.error)
      : null;

  const analyticsErrorMessage = analyticsQuery.apiError
    ? getDeliveryFeedErrorMessage(analyticsQuery.apiError)
    : analyticsQuery.error
      ? getDeliveryFeedErrorMessage(analyticsQuery.error)
      : null;

  /** Rows whose resend is in flight (each row shows its own pending state). */
  const retryingAttemptKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of rows) {
      const deliveryLogId = resolveRetryDeliveryLogId(row.attempt);
      if (deliveryLogId && retryingDeliveryLogIds.has(deliveryLogId)) keys.add(row.attemptKey);
    }
    return keys;
  }, [retryingDeliveryLogIds, rows]);
  const pendingRetryDeliveryLogId = pendingRetryRow
    ? resolveRetryDeliveryLogId(pendingRetryRow.attempt)
    : null;
  const isConfirmingRetry = Boolean(
    pendingRetryDeliveryLogId && retryingDeliveryLogIds.has(pendingRetryDeliveryLogId),
  );

  const handleRetryAttempt = useCallback((attemptKey: string) => {
    setPendingRetryAttemptKey(attemptKey);
  }, []);

  const handleRetryDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isConfirmingRetry) setPendingRetryAttemptKey(null);
    },
    [isConfirmingRetry],
  );

  const { mutateAsync: retryEmail } = retryMutation;
  const handleConfirmRetry = useCallback(async () => {
    if (!pendingRetryRow) return;
    if (!params.restaurantId) {
      setPendingRetryAttemptKey(null);
      toast.error('Retry unavailable', {
        description: 'Select a restaurant before retrying email delivery.',
      });
      return;
    }

    const deliveryLogId = resolveRetryDeliveryLogId(pendingRetryRow.attempt);
    if (!deliveryLogId) {
      setPendingRetryAttemptKey(null);
      toast.error('Retry unavailable', {
        description: 'This email attempt is missing its delivery log id. Refresh and try again.',
      });
      return;
    }

    track('email_delivery_retry_clicked', { provider: 'resend', source: 'ops' });
    try {
      // Sent/failed feedback comes from the mutation (meta.feedback).
      await retryEmail({
        restaurantId: params.restaurantId,
        deliveryLogId,
        bookingId: pendingRetryRow.attempt.bookingId ?? null,
        recipientEmail: pendingRetryRow.recipientEmail,
      });
    } catch {
      track('email_delivery_retry_failed', { provider: 'resend', source: 'ops' });
    } finally {
      setPendingRetryAttemptKey((current) =>
        current === pendingRetryRow.attemptKey ? null : current,
      );
    }
  }, [params.restaurantId, pendingRetryRow, retryEmail]);

  const handleManualRefresh = useCallback(() => {
    if (params.activeTab === 'delivery-log') {
      void feedQuery.refetch();
      return;
    }
    if (params.activeTab === 'analytics') {
      void analyticsQuery.refetch();
      return;
    }
    void queueQuery.refetch();
  }, [analyticsQuery, feedQuery, params.activeTab, queueQuery]);

  const pendingCancelJob = useMemo(
    () =>
      pendingCancelJobId
        ? ((queueQuery.jobs ?? []).find((job) => job.id === pendingCancelJobId) ?? null)
        : null,
    [pendingCancelJobId, queueQuery.jobs],
  );
  const isConfirmingCancel = Boolean(
    pendingCancelJobId && pendingQueueJobIds.has(pendingCancelJobId),
  );

  /** Opens the cancel confirmation; cancelling a scheduled guest email is not reversible. */
  const handleCancelQueueJob = useCallback(
    (jobId: string) => {
      if (!params.restaurantId) {
        toast.error('Cancel unavailable', {
          description: 'Select a restaurant before cancelling a queued email.',
        });
        return;
      }
      setPendingCancelJobId(jobId);
    },
    [params.restaurantId],
  );

  const handleCancelDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isConfirmingCancel) setPendingCancelJobId(null);
    },
    [isConfirmingCancel],
  );

  const { mutateAsync: cancelQueueJob } = cancelQueueJobMutation;
  const handleConfirmCancelQueueJob = useCallback(async () => {
    if (!pendingCancelJobId || !params.restaurantId) {
      setPendingCancelJobId(null);
      return;
    }
    const jobId = pendingCancelJobId;
    try {
      await cancelQueueJob({ restaurantId: params.restaurantId, jobId });
    } catch {
      // Feedback comes from the mutation (meta.feedback).
    } finally {
      setPendingCancelJobId((current) => (current === jobId ? null : current));
    }
  }, [cancelQueueJob, params.restaurantId, pendingCancelJobId]);

  const { mutate: requeueQueueJob } = requeueQueueJobMutation;
  const handleRequeueQueueJob = useCallback(
    (jobId: string) => {
      if (!params.restaurantId) {
        toast.error('Requeue unavailable', {
          description: 'Select a restaurant before requeuing a failed email.',
        });
        return;
      }
      requeueQueueJob({ restaurantId: params.restaurantId, jobId });
    },
    [params.restaurantId, requeueQueueJob],
  );

  const isRefreshing =
    params.activeTab === 'delivery-log'
      ? feedQuery.isFetching
      : params.activeTab === 'analytics'
        ? analyticsQuery.isFetching
        : queueQuery.isFetching;

  const pageInfo =
    feedQuery.response?.ok && feedQuery.response.pageInfo ? feedQuery.response.pageInfo : null;
  const totalResults = feedQuery.summary?.total ?? 0;
  const currentPage = pageInfo?.page ?? params.page;
  const currentPageSize = pageInfo?.pageSize ?? params.pageSize;
  const hasPrevPage = currentPage > 1;
  const hasNextPage = Boolean(pageInfo?.hasNext);
  const shouldShowPagination =
    currentPage > 1 || totalResults > 0 || currentPageSize !== params.pageSize;
  const hasVisibleRows = rows.length > 0 && totalResults > 0;
  const rawStart = totalResults > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;
  const startResult = hasVisibleRows ? Math.min(rawStart, totalResults) : 0;
  const endResult = hasVisibleRows ? Math.min(totalResults, rawStart + rows.length - 1) : 0;

  return {
    refreshIntervalMs,
    feedQuery,
    analyticsQuery,
    queueQuery,
    rows,
    statusCounts,
    deliveryLogErrorMessage,
    analyticsErrorMessage,
    summary: feedQuery.summary ?? null,
    analyticsSummary: analyticsQuery.summary ?? null,
    pendingRetryAttemptKey,
    pendingRetryRow,
    retryingAttemptKeys,
    isConfirmingRetry,
    handleRetryAttempt,
    handleRetryDialogOpenChange,
    handleConfirmRetry,
    handleManualRefresh,
    handleCancelQueueJob,
    pendingCancelJob,
    isCancelDialogOpen: pendingCancelJobId !== null,
    isConfirmingCancel,
    handleCancelDialogOpenChange,
    handleConfirmCancelQueueJob,
    handleRequeueQueueJob,
    pendingQueueJobIds,
    isRefreshing,
    queueStatus,
    setQueueStatus: (status: OpsEmailQueueJobStatus | 'all') => {
      setQueueStatus(status);
      setQueuePage(1);
    },
    queuePage,
    setQueuePage,
    currentPage,
    currentPageSize,
    totalResults,
    shouldShowPagination,
    hasPrevPage,
    hasNextPage,
    startResult,
    endResult,
  };
}

export type OpsEmailDeliveryDataState = ReturnType<typeof useOpsEmailDeliveryDataState>;
