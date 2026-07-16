import type { OpsEmailDeliveryAttemptDTO, OpsEmailDeliveryRange } from '@/types/emailDelivery';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';

export const OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const OPS_EMAIL_DELIVERY_REFRESH_OPTIONS = ['off', '30s', '1m', '5m'] as const;
export const OPS_EMAIL_DELIVERY_TABS = ['delivery-log', 'queue', 'analytics'] as const;

export type OpsEmailDeliveryRefreshOption = (typeof OPS_EMAIL_DELIVERY_REFRESH_OPTIONS)[number];
export type EmailDeliveryTab = (typeof OPS_EMAIL_DELIVERY_TABS)[number];
export type OpsEmailDeliverySearchField = 'recipientEmail' | 'messageId' | 'bookingRef';

export type OpsEmailDeliveryFilterState = {
  tab: EmailDeliveryTab;
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
  searchField: OpsEmailDeliverySearchField;
  searchValue: string;
};

export type OpsEmailDeliveryClientProps = {
  initialTab?: EmailDeliveryTab;
  initialRestaurantId?: string | null;
  initialRange?: OpsEmailDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: EmailDeliveryStatus[];
  initialRecipientEmail?: string | null;
  initialMessageId?: string | null;
  initialBookingRef?: string | null;
  initialTemplateType?: string | null;
  initialEmailType?: string | null;
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
  canRetry: boolean;
};

export type OpsEmailDeliveryRestaurantOption = {
  id: string;
  name: string;
  timezone?: string | null;
};

export const DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE: OpsEmailDeliveryFilterState = {
  tab: 'delivery-log',
  range: '7d',
  page: 1,
  pageSize: 50,
  refresh: 'off',
  statuses: [],
  recipientEmail: null,
  messageId: null,
  bookingRef: null,
  templateType: null,
  emailType: null,
  searchField: 'recipientEmail',
  searchValue: '',
};
