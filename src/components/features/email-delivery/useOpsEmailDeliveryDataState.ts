'use client';

import { useMemo } from 'react';

import { buildOpsEmailDeliveryTableRows } from '@/components/features/email-delivery/opsEmailDeliverySelectors';
import { useOpsEmailDeliveryFeed } from '@/hooks/ops/useOpsEmailDeliveryFeed';
import { useOpsEmailDeliverySummary } from '@src/hooks/ops/useOpsEmailDeliverySummary';

import type {
  OpsEmailDeliveryRefreshOption,
  EmailDeliveryTab,
  OpsEmailDeliveryTableRowViewModel,
} from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

const REFRESH_INTERVALS_MS: Record<Exclude<OpsEmailDeliveryRefreshOption, 'off'>, number> = {
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
};

export function getOpsEmailDeliveryRefreshIntervalMs(
  option: OpsEmailDeliveryRefreshOption,
): number | false {
  if (option === 'off') return false;
  return REFRESH_INTERVALS_MS[option];
}

export function useOpsEmailDeliveryDataState(params: {
  restaurantId: string | null;
  activeTab: EmailDeliveryTab;
  range: OpsEmailDeliveryRange;
  page: number;
  pageSize: number;
  refresh: OpsEmailDeliveryRefreshOption;
  statuses: EmailDeliveryStatus[];
  simulateEmailDeliveryError: boolean;
  fixture: string | null;
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

  const feedQuery = useOpsEmailDeliveryFeed({
    restaurantId: params.restaurantId,
    range: params.range,
    page: params.page,
    pageSize: params.pageSize,
    status: params.statuses.length > 0 ? params.statuses : undefined,
    refetchIntervalMs: params.activeTab === 'delivery-log' ? refreshIntervalMs : false,
    simulateEmailDeliveryError: params.simulateEmailDeliveryError,
    fixture: params.fixture ?? undefined,
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
    simulateEmailDeliveryError: params.simulateEmailDeliveryError,
    recipientEmail: params.recipientEmail ?? undefined,
    messageId: params.messageId ?? undefined,
    bookingRef: params.bookingRef ?? undefined,
    templateType: params.templateType ?? undefined,
    emailType: params.emailType ?? undefined,
  });

  const attempts = useMemo(() => feedQuery.attempts ?? [], [feedQuery.attempts]);
  const summary = feedQuery.summary ?? null;
  const analyticsSummary = analyticsQuery.summary ?? null;

  const rows = useMemo<OpsEmailDeliveryTableRowViewModel[]>(
    () => buildOpsEmailDeliveryTableRows({ attempts, timezone: params.timezone }),
    [attempts, params.timezone],
  );

  const rowByKey = useMemo(() => new Map(rows.map((row) => [row.attemptKey, row])), [rows]);

  const statusCounts = useMemo(
    () =>
      summary
        ? ({
            sent: summary.sent,
            delivered: summary.delivered,
            delivery_delayed: summary.deliveryDelayed,
            bounced: summary.bounced,
            complained: summary.complained,
            failed: summary.failed,
          } satisfies Partial<Record<EmailDeliveryStatus, number>>)
        : null,
    [summary],
  );

  return {
    refreshIntervalMs,
    feedQuery,
    analyticsQuery,
    attempts,
    summary,
    analyticsSummary,
    rows,
    rowByKey,
    statusCounts,
  };
}
