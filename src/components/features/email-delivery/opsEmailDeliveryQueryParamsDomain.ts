import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';

import type {
  EmailDeliveryTab,
  OpsEmailDeliveryClientStateParams,
  OpsEmailDeliveryRefreshOption,
} from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryQueryDefaults = {
  initialTab: EmailDeliveryTab;
  initialRestaurantId: string | null;
  initialRange: OpsEmailDeliveryRange;
  initialPage: number;
  initialPageSize: number;
  initialStatuses: EmailDeliveryStatus[];
  initialSimulateEmailDeliveryError: boolean;
  initialFixture: string | null;
  initialQueueFixture: string | null;
  initialSimulateRetryMutationError: boolean;
  initialRecipientEmail: string | null;
  initialMessageId: string | null;
  initialBookingRef: string | null;
  initialTemplateType: string | null;
  initialEmailType: string | null;
};

export type OpsEmailDeliveryParsedQuery = OpsEmailDeliveryClientStateParams & {
  restaurantId: string | null;
  statuses: EmailDeliveryStatus[];
  simulateEmailDeliveryError: boolean;
  simulateRetryMutationError: boolean;
};

export type OpsEmailDeliveryQuerySyncState = OpsEmailDeliveryClientStateParams & {
  statuses: EmailDeliveryStatus[];
  simulateEmailDeliveryError: boolean;
  simulateRetryMutationError: boolean;
};

export type OpsEmailDeliveryQuerySyncNext = Partial<OpsEmailDeliveryClientStateParams> & {
  restaurantId?: string | null;
  statuses?: EmailDeliveryStatus[];
  simulateEmailDeliveryError?: boolean;
  simulateRetryMutationError?: boolean;
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
    if (allowed.has(part)) {
      out.push(part as EmailDeliveryStatus);
    }
  }

  return out;
}

function parseRefreshOption(raw: string | null): OpsEmailDeliveryRefreshOption {
  if (raw === '30s' || raw === '1m' || raw === '5m') return raw;
  return 'off';
}

function parseOptionalQueryString(raw: string | null, fallback: string | null): string | null {
  const value = raw?.trim() || fallback;
  return value ? value.trim() : null;
}

export function getOpsEmailDeliveryTargetPath(pathname: string | null): string {
  if (pathname?.startsWith('/app')) return '/app/email-delivery';
  if (pathname) return pathname;
  return '/email-delivery';
}

export function parseOpsEmailDeliveryQuery(
  searchKey: string,
  defaults: OpsEmailDeliveryQueryDefaults,
): OpsEmailDeliveryParsedQuery {
  const sp = new URLSearchParams(searchKey);
  const restaurantIdParam =
    parseOpsEmailDeliveryUuid(sp.get('restaurantId')) ?? defaults.initialRestaurantId;
  const rangeParam = parseRange(sp.get('range'), defaults.initialRange);
  const pageParam = Math.max(1, parseIntParam(sp.get('page'), defaults.initialPage));
  const pageSizeParam = Math.max(
    1,
    Math.min(200, parseIntParam(sp.get('pageSize'), defaults.initialPageSize)),
  );
  const statuses = parseStatuses(sp.get('status'), defaults.initialStatuses);
  const refresh = parseRefreshOption(sp.get('refresh'));
  const recipientEmail = parseOptionalQueryString(
    sp.get('recipientEmail'),
    defaults.initialRecipientEmail,
  );
  const messageId = parseOptionalQueryString(sp.get('messageId'), defaults.initialMessageId);
  const bookingRef = parseOptionalQueryString(sp.get('bookingRef'), defaults.initialBookingRef);
  const tabParam = sp.get('tab');

  return {
    restaurantId: restaurantIdParam,
    tab:
      tabParam === 'queue' || tabParam === 'analytics' || tabParam === 'delivery-log'
        ? (tabParam as EmailDeliveryTab)
        : defaults.initialTab,
    range: rangeParam,
    page: pageParam,
    pageSize: pageSizeParam,
    statuses,
    refresh,
    simulateEmailDeliveryError:
      sp.get('simulateEmailDeliveryError') === '1' || defaults.initialSimulateEmailDeliveryError,
    simulateRetryMutationError:
      sp.get('simulateRetryMutationError') === '1' || defaults.initialSimulateRetryMutationError,
    fixture: parseOptionalQueryString(sp.get('fixture'), defaults.initialFixture),
    queueFixture: parseOptionalQueryString(sp.get('queueFixture'), defaults.initialQueueFixture),
    recipientEmail,
    messageId,
    bookingRef: bookingRef ? bookingRef.toUpperCase() : null,
    templateType: parseOptionalQueryString(sp.get('templateType'), defaults.initialTemplateType),
    emailType: parseOptionalQueryString(sp.get('emailType'), defaults.initialEmailType),
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
  next: OpsEmailDeliveryQuerySyncNext;
  current: OpsEmailDeliveryQuerySyncState;
  defaults: OpsEmailDeliveryQueryDefaults;
  effectiveRestaurantId: string | null;
}): string {
  const { currentSearch, next, current, defaults, effectiveRestaurantId } = params;
  const nextParams = new URLSearchParams(currentSearch);

  applyQueryParam(nextParams, 'restaurantId', next.restaurantId ?? effectiveRestaurantId ?? null);
  applyQueryParam(nextParams, 'range', next.range ?? current.range, defaults.initialRange);
  applyQueryParam(nextParams, 'page', next.page ?? current.page, defaults.initialPage);
  applyQueryParam(
    nextParams,
    'pageSize',
    next.pageSize ?? current.pageSize,
    defaults.initialPageSize,
  );
  applyQueryParam(nextParams, 'refresh', next.refresh ?? current.refresh, 'off');
  applyQueryParam(
    nextParams,
    'simulateEmailDeliveryError',
    (next.simulateEmailDeliveryError ?? current.simulateEmailDeliveryError) ? '1' : null,
  );
  applyQueryParam(
    nextParams,
    'simulateRetryMutationError',
    (next.simulateRetryMutationError ?? current.simulateRetryMutationError) ? '1' : null,
  );
  applyQueryParam(
    nextParams,
    'fixture',
    next.fixture !== undefined ? next.fixture : current.fixture,
  );
  applyQueryParam(
    nextParams,
    'queueFixture',
    next.queueFixture !== undefined ? next.queueFixture : current.queueFixture,
  );
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

  const nextTab = next.tab ?? current.tab;
  if (nextTab === 'delivery-log') {
    nextParams.delete('tab');
  } else {
    nextParams.set('tab', nextTab);
  }

  return nextParams.toString();
}
