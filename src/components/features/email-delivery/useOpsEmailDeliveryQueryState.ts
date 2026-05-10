'use client';

import { useRouter, type ReadonlyURLSearchParams } from 'next/navigation';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';

import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';

import type { SearchField } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';
import type {
  EmailDeliveryTab,
  OpsEmailDeliveryClientStateParams,
  OpsEmailDeliveryRefreshOption,
} from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

type QueryDefaults = {
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

function parseUuid(raw: string | null): string | null {
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

function resolveSearchField(filters: {
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
}): SearchField {
  if (filters.messageId) return 'messageId';
  if (filters.bookingRef) return 'bookingRef';
  return 'recipientEmail';
}

function resolveSearchValue(filters: {
  recipientEmail: string | null;
  messageId: string | null;
  bookingRef: string | null;
}): string {
  if (filters.recipientEmail) return filters.recipientEmail;
  if (filters.messageId) return filters.messageId;
  if (filters.bookingRef) return filters.bookingRef;
  return '';
}

function getTargetPath(pathname: string | null): string {
  if (pathname?.startsWith('/app')) return '/app/email-delivery';
  if (pathname) return pathname;
  return '/email-delivery';
}

export function useOpsEmailDeliveryQueryState(
  params: {
    pathname: string | null;
    searchParams: URLSearchParams | ReadonlyURLSearchParams | null;
    effectiveRestaurantId: string | null;
  } & QueryDefaults,
) {
  const router = useRouter();
  const targetPath = useMemo(() => getTargetPath(params.pathname), [params.pathname]);
  const searchKey = useMemo(() => params.searchParams?.toString() ?? '', [params.searchParams]);

  const parsedFromQuery = useMemo(() => {
    const sp = new URLSearchParams(searchKey);
    const restaurantIdParam = parseUuid(sp.get('restaurantId')) ?? params.initialRestaurantId;
    const rangeParam = parseRange(sp.get('range'), params.initialRange);
    const pageParam = Math.max(1, parseIntParam(sp.get('page'), params.initialPage));
    const pageSizeParam = Math.max(
      1,
      Math.min(200, parseIntParam(sp.get('pageSize'), params.initialPageSize)),
    );
    const statuses = parseStatuses(sp.get('status'), params.initialStatuses);
    const refresh = parseRefreshOption(sp.get('refresh'));
    const fixture = sp.get('fixture')?.trim() || params.initialFixture;
    const queueFixture = sp.get('queueFixture')?.trim() || params.initialQueueFixture;
    const recipientEmail = sp.get('recipientEmail')?.trim() || params.initialRecipientEmail;
    const messageId = sp.get('messageId')?.trim() || params.initialMessageId;
    const bookingRef = sp.get('bookingRef')?.trim() || params.initialBookingRef;
    const templateType = sp.get('templateType')?.trim() || params.initialTemplateType;
    const emailType = sp.get('emailType')?.trim() || params.initialEmailType;
    const tabParam = sp.get('tab');

    return {
      restaurantId: restaurantIdParam,
      tab:
        tabParam === 'queue' || tabParam === 'analytics' || tabParam === 'delivery-log'
          ? (tabParam as EmailDeliveryTab)
          : params.initialTab,
      range: rangeParam,
      page: pageParam,
      pageSize: pageSizeParam,
      statuses,
      refresh,
      simulateEmailDeliveryError:
        sp.get('simulateEmailDeliveryError') === '1' || params.initialSimulateEmailDeliveryError,
      simulateRetryMutationError:
        sp.get('simulateRetryMutationError') === '1' || params.initialSimulateRetryMutationError,
      fixture: fixture ? fixture.trim() : null,
      queueFixture: queueFixture ? queueFixture.trim() : null,
      recipientEmail: recipientEmail ? recipientEmail.trim() : null,
      messageId: messageId ? messageId.trim() : null,
      bookingRef: bookingRef ? bookingRef.trim().toUpperCase() : null,
      templateType: templateType ? templateType.trim() : null,
      emailType: emailType ? emailType.trim() : null,
    };
  }, [
    searchKey,
    params.initialBookingRef,
    params.initialEmailType,
    params.initialFixture,
    params.initialMessageId,
    params.initialPage,
    params.initialPageSize,
    params.initialQueueFixture,
    params.initialRange,
    params.initialRecipientEmail,
    params.initialRestaurantId,
    params.initialSimulateEmailDeliveryError,
    params.initialSimulateRetryMutationError,
    params.initialStatuses,
    params.initialTab,
    params.initialTemplateType,
  ]);

  const [tab, setTab] = useState<EmailDeliveryTab>(parsedFromQuery.tab);
  const [range, setRange] = useState<OpsEmailDeliveryRange>(parsedFromQuery.range);
  const [statuses, setStatuses] = useState<EmailDeliveryStatus[]>(parsedFromQuery.statuses);
  const [page, setPage] = useState<number>(parsedFromQuery.page);
  const [pageSize, setPageSize] = useState<number>(parsedFromQuery.pageSize);
  const [refresh, setRefresh] = useState<OpsEmailDeliveryRefreshOption>(parsedFromQuery.refresh);
  const [simulateEmailDeliveryError, setSimulateEmailDeliveryError] = useState<boolean>(
    parsedFromQuery.simulateEmailDeliveryError,
  );
  const [simulateRetryMutationError, setSimulateRetryMutationError] = useState<boolean>(
    parsedFromQuery.simulateRetryMutationError,
  );
  const [fixture, setFixture] = useState<string | null>(parsedFromQuery.fixture);
  const [queueFixture, setQueueFixture] = useState<string | null>(parsedFromQuery.queueFixture);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(
    parsedFromQuery.recipientEmail,
  );
  const [messageId, setMessageId] = useState<string | null>(parsedFromQuery.messageId);
  const [bookingRef, setBookingRef] = useState<string | null>(parsedFromQuery.bookingRef);
  const [templateType, setTemplateType] = useState<string | null>(parsedFromQuery.templateType);
  const [emailType, setEmailType] = useState<string | null>(parsedFromQuery.emailType);
  const [searchField, setSearchField] = useState<SearchField>(() =>
    resolveSearchField({
      recipientEmail: parsedFromQuery.recipientEmail,
      messageId: parsedFromQuery.messageId,
      bookingRef: parsedFromQuery.bookingRef,
    }),
  );
  const [searchValue, setSearchValue] = useState(() =>
    resolveSearchValue({
      recipientEmail: parsedFromQuery.recipientEmail,
      messageId: parsedFromQuery.messageId,
      bookingRef: parsedFromQuery.bookingRef,
    }),
  );

  useEffect(() => {
    setTab(parsedFromQuery.tab);
    setRange(parsedFromQuery.range);
    setStatuses(parsedFromQuery.statuses);
    setPage(parsedFromQuery.page);
    setPageSize(parsedFromQuery.pageSize);
    setRefresh(parsedFromQuery.refresh);
    setSimulateEmailDeliveryError(parsedFromQuery.simulateEmailDeliveryError);
    setSimulateRetryMutationError(parsedFromQuery.simulateRetryMutationError);
    setFixture(parsedFromQuery.fixture);
    setQueueFixture(parsedFromQuery.queueFixture);
    setRecipientEmail(parsedFromQuery.recipientEmail);
    setMessageId(parsedFromQuery.messageId);
    setBookingRef(parsedFromQuery.bookingRef);
    setTemplateType(parsedFromQuery.templateType);
    setEmailType(parsedFromQuery.emailType);
    setSearchField(
      resolveSearchField({
        recipientEmail: parsedFromQuery.recipientEmail,
        messageId: parsedFromQuery.messageId,
        bookingRef: parsedFromQuery.bookingRef,
      }),
    );
    setSearchValue(
      resolveSearchValue({
        recipientEmail: parsedFromQuery.recipientEmail,
        messageId: parsedFromQuery.messageId,
        bookingRef: parsedFromQuery.bookingRef,
      }),
    );
  }, [parsedFromQuery]);

  const syncQueryParams = useCallback(
    (
      next: Partial<OpsEmailDeliveryClientStateParams> & {
        restaurantId?: string | null;
        statuses?: EmailDeliveryStatus[];
        simulateEmailDeliveryError?: boolean;
        simulateRetryMutationError?: boolean;
      },
    ) => {
      const current = params.searchParams?.toString() ?? '';
      const nextParams = new URLSearchParams(current);

      const applyParam = (
        key: string,
        value: string | number | null | undefined,
        defaultValue?: string | number,
      ) => {
        if (
          value === undefined ||
          value === null ||
          value === '' ||
          (defaultValue !== undefined && value === defaultValue)
        ) {
          nextParams.delete(key);
          return;
        }

        nextParams.set(key, String(value));
      };

      applyParam('restaurantId', next.restaurantId ?? params.effectiveRestaurantId ?? null);
      applyParam('range', next.range ?? range, params.initialRange);
      applyParam('page', next.page ?? page, params.initialPage);
      applyParam('pageSize', next.pageSize ?? pageSize, params.initialPageSize);
      applyParam('refresh', next.refresh ?? refresh, 'off');
      applyParam(
        'simulateEmailDeliveryError',
        (next.simulateEmailDeliveryError ?? simulateEmailDeliveryError) ? '1' : null,
      );
      applyParam(
        'simulateRetryMutationError',
        (next.simulateRetryMutationError ?? simulateRetryMutationError) ? '1' : null,
      );
      applyParam('fixture', next.fixture !== undefined ? next.fixture : fixture);
      applyParam(
        'queueFixture',
        next.queueFixture !== undefined ? next.queueFixture : queueFixture,
      );
      applyParam(
        'recipientEmail',
        next.recipientEmail !== undefined ? next.recipientEmail : recipientEmail,
      );
      applyParam('messageId', next.messageId !== undefined ? next.messageId : messageId);
      applyParam('bookingRef', next.bookingRef !== undefined ? next.bookingRef : bookingRef);
      applyParam(
        'templateType',
        next.templateType !== undefined ? next.templateType : templateType,
      );
      applyParam('emailType', next.emailType !== undefined ? next.emailType : emailType);

      const nextStatuses = next.statuses ?? statuses;
      applyParam('status', nextStatuses.length > 0 ? nextStatuses.join(',') : null);

      const nextTab = next.tab ?? tab;
      if (nextTab === 'delivery-log') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', nextTab);
      }

      const nextString = nextParams.toString();
      if (nextString === current) return;

      startTransition(() => {
        router.replace(`${targetPath}${nextString ? `?${nextString}` : ''}`, {
          scroll: false,
        });
      });
    },
    [
      bookingRef,
      emailType,
      fixture,
      messageId,
      page,
      pageSize,
      params.effectiveRestaurantId,
      params.initialPage,
      params.initialPageSize,
      params.initialRange,
      params.searchParams,
      queueFixture,
      range,
      recipientEmail,
      refresh,
      router,
      simulateEmailDeliveryError,
      simulateRetryMutationError,
      statuses,
      tab,
      targetPath,
      templateType,
    ],
  );

  const resetToDefaults = useCallback(
    (restaurantId: string | null) => {
      setTab(params.initialTab);
      setRange(params.initialRange);
      setStatuses(params.initialStatuses);
      setPage(params.initialPage);
      setPageSize(params.initialPageSize);
      setRefresh('off');
      setSimulateEmailDeliveryError(params.initialSimulateEmailDeliveryError);
      setSimulateRetryMutationError(params.initialSimulateRetryMutationError);
      setFixture(params.initialFixture);
      setQueueFixture(params.initialQueueFixture);
      setRecipientEmail(params.initialRecipientEmail);
      setMessageId(params.initialMessageId);
      setBookingRef(params.initialBookingRef);
      setTemplateType(params.initialTemplateType);
      setEmailType(params.initialEmailType);
      setSearchField(
        resolveSearchField({
          recipientEmail: params.initialRecipientEmail,
          messageId: params.initialMessageId,
          bookingRef: params.initialBookingRef,
        }),
      );
      setSearchValue(
        resolveSearchValue({
          recipientEmail: params.initialRecipientEmail,
          messageId: params.initialMessageId,
          bookingRef: params.initialBookingRef,
        }),
      );

      syncQueryParams({
        restaurantId,
        tab: params.initialTab,
        range: params.initialRange,
        page: params.initialPage,
        pageSize: params.initialPageSize,
        refresh: 'off',
        statuses: params.initialStatuses,
        simulateEmailDeliveryError: params.initialSimulateEmailDeliveryError,
        simulateRetryMutationError: params.initialSimulateRetryMutationError,
        fixture: params.initialFixture,
        queueFixture: params.initialQueueFixture,
        recipientEmail: params.initialRecipientEmail,
        messageId: params.initialMessageId,
        bookingRef: params.initialBookingRef,
        templateType: params.initialTemplateType,
        emailType: params.initialEmailType,
      });
    },
    [
      params.initialBookingRef,
      params.initialEmailType,
      params.initialFixture,
      params.initialMessageId,
      params.initialPage,
      params.initialPageSize,
      params.initialQueueFixture,
      params.initialRange,
      params.initialRecipientEmail,
      params.initialSimulateEmailDeliveryError,
      params.initialSimulateRetryMutationError,
      params.initialStatuses,
      params.initialTab,
      params.initialTemplateType,
      syncQueryParams,
    ],
  );

  const applyRange = useCallback(
    (nextRange: OpsEmailDeliveryRange) => {
      setRange(nextRange);
      setPage(1);
      syncQueryParams({ range: nextRange, page: 1 });
    },
    [syncQueryParams],
  );

  const applyTemplateType = useCallback(
    (nextTemplateType: string | null) => {
      setTemplateType(nextTemplateType);
      setPage(1);
      syncQueryParams({ templateType: nextTemplateType, page: 1 });
    },
    [syncQueryParams],
  );

  const applyEmailType = useCallback(
    (nextEmailType: string | null) => {
      setEmailType(nextEmailType);
      setPage(1);
      syncQueryParams({ emailType: nextEmailType, page: 1 });
    },
    [syncQueryParams],
  );

  const applyRefresh = useCallback(
    (nextRefresh: OpsEmailDeliveryRefreshOption) => {
      setRefresh(nextRefresh);
      syncQueryParams({ refresh: nextRefresh });
    },
    [syncQueryParams],
  );

  const submitSearch = useCallback(() => {
    const trimmed = searchValue.trim();
    const nextRecipientEmail =
      searchField === 'recipientEmail' && trimmed ? trimmed.toLowerCase() : null;
    const nextMessageId = searchField === 'messageId' && trimmed ? trimmed : null;
    const nextBookingRef = searchField === 'bookingRef' && trimmed ? trimmed.toUpperCase() : null;

    setRecipientEmail(nextRecipientEmail);
    setMessageId(nextMessageId);
    setBookingRef(nextBookingRef);
    setPage(1);

    syncQueryParams({
      recipientEmail: nextRecipientEmail,
      messageId: nextMessageId,
      bookingRef: nextBookingRef,
      page: 1,
    });
  }, [searchField, searchValue, syncQueryParams]);

  const toggleStatus = useCallback(
    (status: EmailDeliveryStatus, enabled: boolean) => {
      const next = enabled
        ? Array.from(new Set([...statuses, status]))
        : statuses.filter((value) => value !== status);

      setStatuses(next);
      setPage(1);
      syncQueryParams({ statuses: next, page: 1 });
    },
    [statuses, syncQueryParams],
  );

  const clearFilters = useCallback(() => {
    setSearchField('recipientEmail');
    setSearchValue('');
    setRecipientEmail(null);
    setMessageId(null);
    setBookingRef(null);
    setTemplateType(null);
    setEmailType(null);
    setStatuses([]);
    setRange('7d');
    setPage(1);
    setSimulateEmailDeliveryError(false);
    setSimulateRetryMutationError(false);
    setFixture(null);
    setQueueFixture(null);

    syncQueryParams({
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
    });
  }, [syncQueryParams]);

  const applyPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      syncQueryParams({ page: nextPage });
    },
    [syncQueryParams],
  );

  const applyPageSize = useCallback(
    (nextPageSize: number) => {
      setPageSize(nextPageSize);
      setPage(1);
      syncQueryParams({ page: 1, pageSize: nextPageSize });
    },
    [syncQueryParams],
  );

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (nextTab !== 'delivery-log' && nextTab !== 'queue' && nextTab !== 'analytics') return;
      const typedTab = nextTab as EmailDeliveryTab;
      setTab(typedTab);
      syncQueryParams({ tab: typedTab });
    },
    [syncQueryParams],
  );

  return {
    parsedRestaurantId: parsedFromQuery.restaurantId,
    tab,
    range,
    statuses,
    page,
    pageSize,
    refresh,
    simulateEmailDeliveryError,
    simulateRetryMutationError,
    fixture,
    queueFixture,
    recipientEmail,
    messageId,
    bookingRef,
    templateType,
    emailType,
    searchField,
    searchValue,
    setSearchField,
    setSearchValue,
    syncQueryParams,
    resetToDefaults,
    applyRange,
    applyTemplateType,
    applyEmailType,
    applyRefresh,
    submitSearch,
    toggleStatus,
    clearFilters,
    applyPage,
    applyPageSize,
    handleTabChange,
  };
}
