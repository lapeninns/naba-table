'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsEmailDeliveryFeed } from '@/hooks/ops/useOpsEmailDeliveryFeed';
import { useOpsEmailDeliverySummary } from '@/hooks/ops/useOpsEmailDeliverySummary';
import { useOpsEmailQueueFeed } from '@/hooks/ops/useOpsEmailQueueFeed';
import { track } from '@/lib/analytics';
import { HttpError } from '@/lib/http/errors';

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
  const { bookingService } = useOpsServices();
  const refreshIntervalMs = useMemo(
    () => getOpsEmailDeliveryRefreshIntervalMs(params.refresh),
    [params.refresh],
  );

  const [queueStatus, setQueueStatus] = useState<OpsEmailQueueJobStatus | 'all'>('all');
  const [queuePage, setQueuePage] = useState(1);
  const [pendingRetryAttemptKey, setPendingRetryAttemptKey] = useState<string | null>(null);
  const [retryingAttemptKey, setRetryingAttemptKey] = useState<string | null>(null);
  const [queueActionJobId, setQueueActionJobId] = useState<string | null>(null);

  useEffect(() => {
    setQueuePage(1);
    setQueueStatus('all');
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

  const handleRetryAttempt = useCallback((attemptKey: string) => {
    setPendingRetryAttemptKey(attemptKey);
  }, []);

  const handleRetryDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !retryingAttemptKey) setPendingRetryAttemptKey(null);
    },
    [retryingAttemptKey],
  );

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

    setRetryingAttemptKey(pendingRetryRow.attemptKey);
    track('email_delivery_retry_clicked', { provider: 'resend', source: 'ops' });

    try {
      await bookingService.retryEmailDelivery({
        restaurantId: params.restaurantId,
        deliveryLogId,
      });
      toast.success('Retry queued', {
        description: `Resending ${pendingRetryRow.attempt.emailType ?? 'email'} to ${pendingRetryRow.recipientEmail}.`,
      });
      setPendingRetryAttemptKey(null);
      await feedQuery.refetch();
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
  }, [bookingService, feedQuery, params.restaurantId, pendingRetryRow]);

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

  const handleCancelQueueJob = useCallback(
    async (jobId: string) => {
      if (!params.restaurantId) {
        toast.error('Cancel unavailable', {
          description: 'Select a restaurant before cancelling a queued email.',
        });
        return;
      }
      setQueueActionJobId(jobId);
      try {
        await bookingService.cancelEmailQueueJob({
          restaurantId: params.restaurantId,
          jobId,
        });
        toast.success('Queue job cancelled');
        await queueQuery.refetch();
      } catch (error) {
        toast.error('Cancel failed', {
          description:
            error instanceof HttpError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Failed to cancel queue job',
        });
      } finally {
        setQueueActionJobId(null);
      }
    },
    [bookingService, params.restaurantId, queueQuery],
  );

  const handleRequeueQueueJob = useCallback(
    async (jobId: string) => {
      if (!params.restaurantId) {
        toast.error('Requeue unavailable', {
          description: 'Select a restaurant before requeuing a failed email.',
        });
        return;
      }
      setQueueActionJobId(jobId);
      try {
        await bookingService.requeueEmailQueueJob({
          restaurantId: params.restaurantId,
          jobId,
        });
        toast.success('Queue job requeued');
        await queueQuery.refetch();
      } catch (error) {
        toast.error('Requeue failed', {
          description:
            error instanceof HttpError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Failed to requeue queue job',
        });
      } finally {
        setQueueActionJobId(null);
      }
    },
    [bookingService, params.restaurantId, queueQuery],
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
    retryingAttemptKey,
    handleRetryAttempt,
    handleRetryDialogOpenChange,
    handleConfirmRetry,
    handleManualRefresh,
    handleCancelQueueJob,
    handleRequeueQueueJob,
    queueActionJobId,
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
