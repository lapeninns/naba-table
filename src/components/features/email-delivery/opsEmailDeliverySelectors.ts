import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';

import {
  EMAIL_DELIVERY_STATUS_LABELS,
  canRetryEmailDelivery,
  formatEmailDeliveryOccurredAt,
} from './opsEmailDeliveryDomain';
import {
  DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE,
  type EmailDeliveryTab,
  type OpsEmailDeliveryClientProps,
  type OpsEmailDeliveryFilterState,
  type OpsEmailDeliveryRefreshOption,
  type OpsEmailDeliverySearchField,
  type OpsEmailDeliveryTableRowViewModel,
} from './opsEmailDeliveryTypes';

import type { EmailDeliveryStatus, OpsEmailDeliveryAttemptDTO, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryParsedQuery = OpsEmailDeliveryFilterState & {
  restaurantId: string | null;
};

export type OpsEmailDeliveryQueryPatch = Partial<OpsEmailDeliveryFilterState> & {
  restaurantId?: string | null;
};

export function parseOpsEmailDeliveryUuid(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function parseRange(raw: string | null, fallback: OpsEmailDeliveryRange): OpsEmailDeliveryRange {
  if (raw === '24h' || raw === '7d' || raw === '30d') return raw;
  return fallback;
}

function parseIntParam(raw: string | null, fallback: number): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseStatuses(raw: string | null, fallback: EmailDeliveryStatus[]): EmailDeliveryStatus[] {
  if (!raw) return fallback;
  const allowed = new Set<string>(EMAIL_DELIVERY_STATUS_VALUES);
  const out: EmailDeliveryStatus[] = [];
  for (const part of raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (allowed.has(part)) out.push(part as EmailDeliveryStatus);
  }
  return out;
}

function parseRefresh(raw: string | null): OpsEmailDeliveryRefreshOption {
  if (raw === '30s' || raw === '1m' || raw === '5m') return raw;
  return 'off';
}

function parseOptional(raw: string | null, fallback: string | null): string | null {
  const value = raw?.trim() || fallback;
  return value ? value.trim() : null;
}

function parseTab(raw: string | null, fallback: EmailDeliveryTab): EmailDeliveryTab {
  if (raw === 'queue' || raw === 'analytics' || raw === 'delivery-log') return raw;
  return fallback;
}

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
  return filters.recipientEmail ?? filters.messageId ?? filters.bookingRef ?? '';
}

export function buildOpsEmailDeliverySubmittedSearch({
  searchField,
  searchValue,
}: {
  searchField: OpsEmailDeliverySearchField;
  searchValue: string;
}): Pick<OpsEmailDeliveryFilterState, 'recipientEmail' | 'messageId' | 'bookingRef' | 'page'> {
  const trimmed = searchValue.trim();
  return {
    recipientEmail: searchField === 'recipientEmail' && trimmed ? trimmed.toLowerCase() : null,
    messageId: searchField === 'messageId' && trimmed ? trimmed : null,
    bookingRef: searchField === 'bookingRef' && trimmed ? trimmed.toUpperCase() : null,
    page: 1,
  };
}

export function getOpsEmailDeliveryTargetPath(pathname: string | null): string {
  if (pathname?.startsWith('/app')) return '/app/email-delivery';
  if (pathname) return pathname;
  return '/email-delivery';
}

export function buildDefaultsFromProps(
  props: OpsEmailDeliveryClientProps,
): OpsEmailDeliveryFilterState {
  const recipientEmail = props.initialRecipientEmail ?? null;
  const messageId = props.initialMessageId ?? null;
  const bookingRef = props.initialBookingRef ?? null;
  return {
    tab: props.initialTab ?? DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE.tab,
    range: props.initialRange ?? DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE.range,
    page: Math.max(1, props.initialPage ?? 1),
    pageSize: Math.max(1, Math.min(200, props.initialPageSize ?? 50)),
    refresh: 'off',
    statuses: props.initialStatuses ?? [],
    recipientEmail,
    messageId,
    bookingRef: bookingRef ? bookingRef.toUpperCase() : null,
    templateType: props.initialTemplateType ?? null,
    emailType: props.initialEmailType ?? null,
    searchField: resolveOpsEmailDeliverySearchField({ recipientEmail, messageId, bookingRef }),
    searchValue: resolveOpsEmailDeliverySearchValue({ recipientEmail, messageId, bookingRef }),
  };
}

export function parseOpsEmailDeliveryQuery(
  searchKey: string,
  defaults: OpsEmailDeliveryFilterState,
  initialRestaurantId: string | null = null,
): OpsEmailDeliveryParsedQuery {
  const sp = new URLSearchParams(searchKey);
  const recipientEmail = parseOptional(sp.get('recipientEmail'), defaults.recipientEmail);
  const messageId = parseOptional(sp.get('messageId'), defaults.messageId);
  const bookingRefRaw = parseOptional(sp.get('bookingRef'), defaults.bookingRef);
  const bookingRef = bookingRefRaw ? bookingRefRaw.toUpperCase() : null;

  return {
    restaurantId: parseOpsEmailDeliveryUuid(sp.get('restaurantId')) ?? initialRestaurantId,
    tab: parseTab(sp.get('tab'), defaults.tab),
    range: parseRange(sp.get('range'), defaults.range),
    page: Math.max(1, parseIntParam(sp.get('page'), defaults.page)),
    pageSize: Math.max(1, Math.min(200, parseIntParam(sp.get('pageSize'), defaults.pageSize))),
    refresh: parseRefresh(sp.get('refresh')),
    statuses: parseStatuses(sp.get('status'), defaults.statuses),
    recipientEmail,
    messageId,
    bookingRef,
    templateType: parseOptional(sp.get('templateType'), defaults.templateType),
    emailType: parseOptional(sp.get('emailType'), defaults.emailType),
    searchField: resolveOpsEmailDeliverySearchField({ recipientEmail, messageId, bookingRef }),
    searchValue: resolveOpsEmailDeliverySearchValue({ recipientEmail, messageId, bookingRef }),
  };
}

function applyQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
  defaultValue?: string | number,
) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (defaultValue !== undefined && value === defaultValue)
  ) {
    params.delete(key);
    return;
  }
  params.set(key, String(value));
}

export function buildOpsEmailDeliveryQueryString(params: {
  currentSearch: string;
  next: OpsEmailDeliveryQueryPatch;
  current: OpsEmailDeliveryFilterState;
  defaults: OpsEmailDeliveryFilterState;
  effectiveRestaurantId: string | null;
}): string {
  const { currentSearch, next, current, defaults, effectiveRestaurantId } = params;
  const nextParams = new URLSearchParams(currentSearch);

  applyQueryParam(nextParams, 'restaurantId', next.restaurantId ?? effectiveRestaurantId ?? null);
  applyQueryParam(nextParams, 'range', next.range ?? current.range, defaults.range);
  applyQueryParam(nextParams, 'page', next.page ?? current.page, defaults.page);
  applyQueryParam(nextParams, 'pageSize', next.pageSize ?? current.pageSize, defaults.pageSize);
  applyQueryParam(nextParams, 'refresh', next.refresh ?? current.refresh, 'off');
  applyQueryParam(
    nextParams,
    'recipientEmail',
    next.recipientEmail !== undefined ? next.recipientEmail : current.recipientEmail,
  );
  applyQueryParam(
    nextParams,
    'messageId',
    next.messageId !== undefined ? next.messageId : current.messageId,
  );
  applyQueryParam(
    nextParams,
    'bookingRef',
    next.bookingRef !== undefined ? next.bookingRef : current.bookingRef,
  );
  applyQueryParam(
    nextParams,
    'templateType',
    next.templateType !== undefined ? next.templateType : current.templateType,
  );
  applyQueryParam(
    nextParams,
    'emailType',
    next.emailType !== undefined ? next.emailType : current.emailType,
  );

  const nextStatuses = next.statuses ?? current.statuses;
  applyQueryParam(nextParams, 'status', nextStatuses.length > 0 ? nextStatuses.join(',') : null);

  // Drop production-only harness params if present in the URL.
  nextParams.delete('fixture');
  nextParams.delete('queueFixture');
  nextParams.delete('simulateEmailDeliveryError');
  nextParams.delete('simulateRetryMutationError');

  const nextTab = next.tab ?? current.tab;
  if (nextTab === 'delivery-log') {
    nextParams.delete('tab');
  } else {
    nextParams.set('tab', nextTab);
  }

  return nextParams.toString();
}

export function getOpsEmailDeliveryAttemptKey(attempt: OpsEmailDeliveryAttemptDTO): string {
  return `${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`;
}

export function resolveOpsEmailDeliveryAttemptSubject(attempt: OpsEmailDeliveryAttemptDTO): string {
  for (const event of attempt.events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;
    const subject = (meta as { subject?: unknown }).subject;
    if (typeof subject === 'string' && subject.trim().length > 0) {
      return subject.trim();
    }
  }
  return attempt.templateType ?? attempt.emailType ?? 'Email';
}

export function buildOpsEmailDeliveryTableRows(params: {
  attempts: OpsEmailDeliveryAttemptDTO[];
  timezone: string;
}): OpsEmailDeliveryTableRowViewModel[] {
  const { attempts, timezone } = params;
  return attempts.map((attempt) => ({
    attemptKey: getOpsEmailDeliveryAttemptKey(attempt),
    attempt,
    currentStatusLabel:
      EMAIL_DELIVERY_STATUS_LABELS[attempt.currentStatus] ?? attempt.currentStatus,
    subject: resolveOpsEmailDeliveryAttemptSubject(attempt),
    recipientEmail: attempt.recipientEmail,
    emailType: attempt.emailType,
    bookingReference: attempt.booking?.reference ?? null,
    customerName: attempt.booking?.customerName ?? null,
    sentAtLabel: formatEmailDeliveryOccurredAt(attempt.currentOccurredAt, timezone),
    canRetry: canRetryEmailDelivery(attempt.currentStatus),
  }));
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
