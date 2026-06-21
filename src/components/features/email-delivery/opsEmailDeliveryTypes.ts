'use client';

import type { OpsEmailDeliveryAttemptDTO, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export const OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const OPS_EMAIL_DELIVERY_REFRESH_OPTIONS = ['off', '30s', '1m', '5m'] as const;
export const OPS_EMAIL_DELIVERY_TABS = ['delivery-log', 'queue', 'analytics'] as const;

export type OpsEmailDeliveryRefreshOption = (typeof OPS_EMAIL_DELIVERY_REFRESH_OPTIONS)[number];
export type EmailDeliveryTab = (typeof OPS_EMAIL_DELIVERY_TABS)[number];
export type OpsEmailDeliverySearchField = 'recipientEmail' | 'messageId' | 'bookingRef';

export type OpsEmailDeliveryClientStateParams = {
  tab: EmailDeliveryTab;
  range: OpsEmailDeliveryRange;
  page: number;
  pageSize: number;
  refresh: OpsEmailDeliveryRefreshOption;
  fixture: string | null;
  queueFixture: string | null;
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
  templateType: string | null;
  emailType: string | null;
};

export type OpsEmailDeliveryTableRowViewModel = {
  attemptKey: string;
  attempt: OpsEmailDeliveryAttemptDTO;
  currentStatusLabel: string;
  subject: string;
  recipientEmail: string;
  emailType: string | null;
  bookingReference: string | null;
  customerName: string | null;
  sentAtLabel: string | null;
  sentAtMs: number;
  statusSortValue: string;
  canRetry: boolean;
};
