import type {
  OpsEmailDeliveryParsedQuery,
  OpsEmailDeliveryQueryDefaults,
  OpsEmailDeliveryQuerySyncNext,
  OpsEmailDeliveryQuerySyncState,
} from './opsEmailDeliveryQueryParamsDomain';
import type { OpsEmailDeliverySearchField } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';

export {
  buildOpsEmailDeliveryQueryString,
  getOpsEmailDeliveryTargetPath,
  parseOpsEmailDeliveryQuery,
  parseOpsEmailDeliveryUuid,
} from './opsEmailDeliveryQueryParamsDomain';
export type {
  OpsEmailDeliveryParsedQuery,
  OpsEmailDeliveryQueryDefaults,
  OpsEmailDeliveryQuerySyncNext,
  OpsEmailDeliveryQuerySyncState,
} from './opsEmailDeliveryQueryParamsDomain';

export type OpsEmailDeliverySearchDraft = {
  searchField: OpsEmailDeliverySearchField;
  searchValue: string;
};

export type OpsEmailDeliveryQueryStateSnapshot = OpsEmailDeliveryQuerySyncState &
  OpsEmailDeliverySearchDraft;

export type OpsEmailDeliverySearchPatch = Pick<
  OpsEmailDeliveryQuerySyncNext,
  'bookingRef' | 'messageId' | 'page' | 'recipientEmail'
>;

export function resolveOpsEmailDeliverySearchField(filters: {
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
}): OpsEmailDeliverySearchField {
  if (filters.messageId) return 'messageId';
  if (filters.bookingRef) return 'bookingRef';
  return 'recipientEmail';
}

export function resolveOpsEmailDeliverySearchValue(filters: {
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
}): string {
  if (filters.recipientEmail) return filters.recipientEmail;
  if (filters.messageId) return filters.messageId;
  if (filters.bookingRef) return filters.bookingRef;
  return '';
}

export function buildOpsEmailDeliverySubmittedSearch({
  searchField,
  searchValue,
}: OpsEmailDeliverySearchDraft): OpsEmailDeliverySearchPatch {
  const trimmed = searchValue.trim();
  return {
    recipientEmail: searchField === 'recipientEmail' && trimmed ? trimmed.toLowerCase() : null,
    messageId: searchField === 'messageId' && trimmed ? trimmed : null,
    bookingRef: searchField === 'bookingRef' && trimmed ? trimmed.toUpperCase() : null,
    page: 1,
  };
}

export function buildOpsEmailDeliveryQueryStateSnapshot(
  parsed: OpsEmailDeliveryParsedQuery,
): OpsEmailDeliveryQueryStateSnapshot {
  return {
    tab: parsed.tab,
    range: parsed.range,
    statuses: parsed.statuses,
    page: parsed.page,
    pageSize: parsed.pageSize,
    refresh: parsed.refresh,
    simulateEmailDeliveryError: parsed.simulateEmailDeliveryError,
    simulateRetryMutationError: parsed.simulateRetryMutationError,
    fixture: parsed.fixture,
    queueFixture: parsed.queueFixture,
    recipientEmail: parsed.recipientEmail,
    messageId: parsed.messageId,
    bookingRef: parsed.bookingRef,
    templateType: parsed.templateType,
    emailType: parsed.emailType,
    searchField: resolveOpsEmailDeliverySearchField({
      recipientEmail: parsed.recipientEmail,
      messageId: parsed.messageId,
      bookingRef: parsed.bookingRef,
    }),
    searchValue: resolveOpsEmailDeliverySearchValue({
      recipientEmail: parsed.recipientEmail,
      messageId: parsed.messageId,
      bookingRef: parsed.bookingRef,
    }),
  };
}

export function buildOpsEmailDeliveryDefaultsStateSnapshot(
  defaults: OpsEmailDeliveryQueryDefaults,
): OpsEmailDeliveryQueryStateSnapshot {
  return {
    tab: defaults.initialTab,
    range: defaults.initialRange,
    statuses: defaults.initialStatuses,
    page: defaults.initialPage,
    pageSize: defaults.initialPageSize,
    refresh: 'off',
    simulateEmailDeliveryError: defaults.initialSimulateEmailDeliveryError,
    simulateRetryMutationError: defaults.initialSimulateRetryMutationError,
    fixture: defaults.initialFixture,
    queueFixture: defaults.initialQueueFixture,
    recipientEmail: defaults.initialRecipientEmail,
    messageId: defaults.initialMessageId,
    bookingRef: defaults.initialBookingRef,
    templateType: defaults.initialTemplateType,
    emailType: defaults.initialEmailType,
    searchField: resolveOpsEmailDeliverySearchField({
      recipientEmail: defaults.initialRecipientEmail,
      messageId: defaults.initialMessageId,
      bookingRef: defaults.initialBookingRef,
    }),
    searchValue: resolveOpsEmailDeliverySearchValue({
      recipientEmail: defaults.initialRecipientEmail,
      messageId: defaults.initialMessageId,
      bookingRef: defaults.initialBookingRef,
    }),
  };
}

export function buildOpsEmailDeliveryClearFiltersStateSnapshot(
  current: OpsEmailDeliveryQueryStateSnapshot,
): OpsEmailDeliveryQueryStateSnapshot {
  return {
    ...current,
    range: '7d',
    statuses: [],
    page: 1,
    simulateEmailDeliveryError: false,
    simulateRetryMutationError: false,
    fixture: null,
    queueFixture: null,
    recipientEmail: null,
    messageId: null,
    bookingRef: null,
    templateType: null,
    emailType: null,
    searchField: 'recipientEmail',
    searchValue: '',
  };
}

export function toggleOpsEmailDeliveryStatusFilter({
  enabled,
  status,
  statuses,
}: {
  enabled: boolean;
  status: EmailDeliveryStatus;
  statuses: EmailDeliveryStatus[];
}): EmailDeliveryStatus[] {
  return enabled
    ? Array.from(new Set([...statuses, status]))
    : statuses.filter((value) => value !== status);
}

export function buildOpsEmailDeliveryResetNext({
  defaults,
  restaurantId,
}: {
  defaults: OpsEmailDeliveryQueryDefaults;
  restaurantId: string | null;
}): OpsEmailDeliveryQuerySyncNext {
  return {
    restaurantId,
    tab: defaults.initialTab,
    range: defaults.initialRange,
    page: defaults.initialPage,
    pageSize: defaults.initialPageSize,
    refresh: 'off',
    statuses: defaults.initialStatuses,
    simulateEmailDeliveryError: defaults.initialSimulateEmailDeliveryError,
    simulateRetryMutationError: defaults.initialSimulateRetryMutationError,
    fixture: defaults.initialFixture,
    queueFixture: defaults.initialQueueFixture,
    recipientEmail: defaults.initialRecipientEmail,
    messageId: defaults.initialMessageId,
    bookingRef: defaults.initialBookingRef,
    templateType: defaults.initialTemplateType,
    emailType: defaults.initialEmailType,
  };
}

export function buildOpsEmailDeliveryClearFiltersNext(): OpsEmailDeliveryQuerySyncNext {
  return {
    range: '7d',
    page: 1,
    statuses: [],
    simulateEmailDeliveryError: false,
    simulateRetryMutationError: false,
    fixture: null,
    queueFixture: null,
    recipientEmail: null,
    messageId: null,
    bookingRef: null,
    templateType: null,
    emailType: null,
  };
}
