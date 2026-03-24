'use client';

import { AlertCircle, ChevronLeft, ChevronRight, MailWarning, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { OpsEmailDeliveryAnalytics } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalytics';
import { OpsEmailDeliveryFilterBar } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';
import { OpsEmailDeliveryTable } from '@/components/features/email-delivery/components/OpsEmailDeliveryTable';
import { OpsEmailQueuePanel } from '@/components/features/email-delivery/components/OpsEmailQueuePanel';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsEmailDeliveryFeed } from '@/hooks/ops/useOpsEmailDeliveryFeed';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { useOpsEmailDeliverySummary } from '@src/hooks/ops/useOpsEmailDeliverySummary';

import type { SearchField } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';
import type {
  EmailDeliveryStatus,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

const EMPTY_STATUSES: EmailDeliveryStatus[] = [];
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID = '__force_error__';
const DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS = 1500;

const EMAIL_DELIVERY_TABS = ['delivery-log', 'queue', 'analytics'] as const;
export type EmailDeliveryTab = (typeof EMAIL_DELIVERY_TABS)[number];

export type OpsEmailDeliveryClientProps = {
  initialTab?: EmailDeliveryTab;
  initialRestaurantId?: string | null;
  initialRange?: OpsEmailDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: EmailDeliveryStatus[];
  initialSimulateEmailDeliveryError?: boolean;
  initialRecipientEmail?: string | null;
  initialMessageId?: string | null;
  initialBookingRef?: string | null;
  initialTemplateType?: string | null;
  initialEmailType?: string | null;
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
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseStatuses(raw: string | null, fallback: EmailDeliveryStatus[]): EmailDeliveryStatus[] {
  if (!raw) return fallback;
  const allowed = new Set<string>(EMAIL_DELIVERY_STATUS_VALUES);
  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const out: EmailDeliveryStatus[] = [];
  for (const part of parts) {
    if (allowed.has(part)) out.push(part as EmailDeliveryStatus);
  }
  return out;
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

function getDeliveryFeedErrorMessage(error: { message?: string | null; error?: string | null } | Error): string {
  const message = 'message' in error ? error.message : null;
  const fallback = 'error' in error ? error.error : null;
  const raw = message?.trim() || fallback?.trim() || '';

  if (!raw) {
    return 'We could not load the delivery log right now. Please try again.';
  }

  const normalized = raw.toLowerCase();
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed')
  ) {
    return 'We could not reach the delivery log service. Check your connection and try again.';
  }

  return raw;
}

export function OpsEmailDeliveryClient({
  initialTab = 'delivery-log',
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = EMPTY_STATUSES,
  initialSimulateEmailDeliveryError = false,
  initialRecipientEmail = null,
  initialMessageId = null,
  initialBookingRef = null,
  initialTemplateType = null,
  initialEmailType = null,
}: OpsEmailDeliveryClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const opsBasePath = pathname?.startsWith('/app') ? '/app' : '';
  const targetPath = useMemo(() => {
    // When mounted under `/app/...`, keep the canonical Ops routes.
    if (pathname?.startsWith('/app')) {
      return '/app/email-delivery';
    }
    // When mounted in a dev harness route (e.g. `/dev/ops-email-delivery`), keep query sync on
    // the current route instead of navigating to non-existent root aliases.
    if (pathname) {
      return pathname;
    }
    return `${opsBasePath}/email-delivery`;
  }, [opsBasePath, pathname]);

  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { restaurantService } = useOpsServices();
  const membershipIds = useMemo(() => new Set(memberships.map((m) => m.restaurantId)), [memberships]);

  const searchKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);

  const parsedFromQuery = useMemo(() => {
    const sp = new URLSearchParams(searchKey);
    const restaurantIdParam = parseUuid(sp.get('restaurantId')) ?? initialRestaurantId;
    const rangeParam = parseRange(sp.get('range'), initialRange);
    const pageParam = Math.max(1, parseIntParam(sp.get('page'), initialPage));
    const pageSizeParam = Math.max(1, Math.min(200, parseIntParam(sp.get('pageSize'), initialPageSize)));
    const statuses = parseStatuses(sp.get('status'), initialStatuses);
    const simulateEmailDeliveryError =
      sp.get('simulateEmailDeliveryError') === '1' || initialSimulateEmailDeliveryError;

    const recipientEmail = sp.get('recipientEmail')?.trim() || initialRecipientEmail;
    const messageId = sp.get('messageId')?.trim() || initialMessageId;
    const bookingRef = sp.get('bookingRef')?.trim() || initialBookingRef;
    const templateType = sp.get('templateType')?.trim() || initialTemplateType;
    const emailType = sp.get('emailType')?.trim() || initialEmailType;

    return {
      restaurantId: restaurantIdParam,
      range: rangeParam,
      page: pageParam,
      pageSize: pageSizeParam,
      statuses,
      simulateEmailDeliveryError,
      recipientEmail: recipientEmail ? recipientEmail.trim() : null,
      messageId: messageId ? messageId.trim() : null,
      bookingRef: bookingRef ? bookingRef.trim().toUpperCase() : null,
      templateType: templateType ? templateType.trim() : null,
      emailType: emailType ? emailType.trim() : null,
    };
  }, [
    searchKey,
    initialRestaurantId,
    initialRange,
    initialPage,
    initialPageSize,
    initialStatuses,
    initialSimulateEmailDeliveryError,
    initialRecipientEmail,
    initialMessageId,
    initialBookingRef,
    initialTemplateType,
    initialEmailType,
  ]);

  const effectiveRestaurantId = useMemo(() => {
    if (parsedFromQuery.restaurantId && membershipIds.has(parsedFromQuery.restaurantId)) {
      return parsedFromQuery.restaurantId;
    }
    if (activeRestaurantId) return activeRestaurantId;
    return memberships[0]?.restaurantId ?? null;
  }, [activeRestaurantId, membershipIds, memberships, parsedFromQuery.restaurantId]);

  // If a valid restaurantId is present in URL and differs from active selection, adopt it.
  useEffect(() => {
    if (!parsedFromQuery.restaurantId) return;
    if (!membershipIds.has(parsedFromQuery.restaurantId)) return;
    if (parsedFromQuery.restaurantId !== activeRestaurantId) {
      setActiveRestaurantId(parsedFromQuery.restaurantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedFromQuery.restaurantId]);

  const restaurantDetails = useOpsRestaurantDetails(effectiveRestaurantId);
  const [availableRestaurants, setAvailableRestaurants] = useState<
    Array<{ id: string; name: string; timezone?: string | null }>
  >([]);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  useEffect(() => {
    let cancelled = false;

    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          restaurants
            .filter((restaurant) => membershipIds.has(restaurant.id))
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              timezone: restaurant.timezone,
            })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(
          memberships.map((membership) => ({
            id: membership.restaurantId,
            name: membership.restaurantName,
            timezone: null,
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const activeTab = useMemo<EmailDeliveryTab>(() => {
    const sp = new URLSearchParams(searchKey);
    const tabParam = sp.get('tab');
    if (tabParam && (EMAIL_DELIVERY_TABS as readonly string[]).includes(tabParam)) {
      return tabParam as EmailDeliveryTab;
    }
    return initialTab;
  }, [searchKey, initialTab]);
  const [tab, setTab] = useState<EmailDeliveryTab>(activeTab);

  const [range, setRange] = useState<OpsEmailDeliveryRange>(parsedFromQuery.range);
  const [statuses, setStatuses] = useState<EmailDeliveryStatus[]>(parsedFromQuery.statuses);
  const [page, setPage] = useState<number>(parsedFromQuery.page);
  const [pageSize, setPageSize] = useState<number>(parsedFromQuery.pageSize);
  const [simulateEmailDeliveryError, setSimulateEmailDeliveryError] = useState<boolean>(
    parsedFromQuery.simulateEmailDeliveryError,
  );
  const [recipientEmail, setRecipientEmail] = useState<string | null>(parsedFromQuery.recipientEmail);
  const [messageId, setMessageId] = useState<string | null>(parsedFromQuery.messageId);
  const [bookingRef, setBookingRef] = useState<string | null>(parsedFromQuery.bookingRef);
  const [templateType, setTemplateType] = useState<string | null>(parsedFromQuery.templateType);
  const [emailType, setEmailType] = useState<string | null>(parsedFromQuery.emailType);

  const [searchField, setSearchField] = useState<SearchField>(() =>
    resolveSearchField({ recipientEmail, messageId, bookingRef }),
  );
  const [searchValue, setSearchValue] = useState(() =>
    resolveSearchValue({ recipientEmail, messageId, bookingRef }),
  );

  // Keep local state in sync with URL when navigating via back/forward or external links.
  useEffect(() => {
    setRange(parsedFromQuery.range);
    setStatuses(parsedFromQuery.statuses);
    setPage(parsedFromQuery.page);
    setPageSize(parsedFromQuery.pageSize);
    setSimulateEmailDeliveryError(parsedFromQuery.simulateEmailDeliveryError);
    setRecipientEmail(parsedFromQuery.recipientEmail);
    setMessageId(parsedFromQuery.messageId);
    setBookingRef(parsedFromQuery.bookingRef);
    setTemplateType(parsedFromQuery.templateType);
    setEmailType(parsedFromQuery.emailType);
    setSearchField(resolveSearchField({
      recipientEmail: parsedFromQuery.recipientEmail,
      messageId: parsedFromQuery.messageId,
      bookingRef: parsedFromQuery.bookingRef,
    }));
    setSearchValue(resolveSearchValue({
      recipientEmail: parsedFromQuery.recipientEmail,
      messageId: parsedFromQuery.messageId,
      bookingRef: parsedFromQuery.bookingRef,
    }));
  }, [parsedFromQuery]);

  const syncQueryParams = useCallback(
    (next: {
      restaurantId?: string | null;
      range?: OpsEmailDeliveryRange;
      page?: number;
      pageSize?: number;
      statuses?: EmailDeliveryStatus[];
      simulateEmailDeliveryError?: boolean;
      recipientEmail?: string | null;
      messageId?: string | null;
      bookingRef?: string | null;
      templateType?: string | null;
      emailType?: string | null;
      tab?: EmailDeliveryTab;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');

      const applyParam = (key: string, value: string | number | null | undefined, defaultValue?: string | number) => {
        if (value === undefined || value === null || value === '' || (defaultValue !== undefined && value === defaultValue)) {
          params.delete(key);
          return;
        }
        params.set(key, String(value));
      };

      applyParam('restaurantId', next.restaurantId ?? effectiveRestaurantId ?? null);
      applyParam('range', next.range ?? range, '7d');
      applyParam('page', next.page ?? page, 1);
      applyParam('pageSize', next.pageSize ?? pageSize, 50);
      applyParam(
        'simulateEmailDeliveryError',
        next.simulateEmailDeliveryError ?? simulateEmailDeliveryError ? '1' : null,
      );

      const statusValue = next.statuses && next.statuses.length > 0 ? next.statuses.join(',') : null;
      applyParam('status', statusValue);
      applyParam('recipientEmail', next.recipientEmail !== undefined ? next.recipientEmail : recipientEmail);
      applyParam('messageId', next.messageId !== undefined ? next.messageId : messageId);
      applyParam('bookingRef', next.bookingRef !== undefined ? next.bookingRef : bookingRef);
      applyParam('templateType', next.templateType !== undefined ? next.templateType : templateType);
      applyParam('emailType', next.emailType !== undefined ? next.emailType : emailType);

      const nextTab = next.tab ?? tab;
      if (nextTab === 'delivery-log') {
        params.delete('tab');
      } else {
        params.set('tab', nextTab);
      }

      const current = searchParams?.toString() ?? '';
      const nextString = params.toString();
      if (current === nextString) return;

      const nextUrl = `${targetPath}${nextString ? `?${nextString}` : ''}`;
      if (typeof window !== 'undefined') {
        window.history.replaceState(window.history.state, '', nextUrl);
      }
    },
    [
      bookingRef,
      effectiveRestaurantId,
      emailType,
      messageId,
      page,
      pageSize,
      range,
      simulateEmailDeliveryError,
      recipientEmail,
      searchParams,
      tab,
      targetPath,
      templateType,
    ],
  );

  const handleTabChange = useCallback(
    (value: string) => {
      if (!(EMAIL_DELIVERY_TABS as readonly string[]).includes(value)) return;
      const nextTab = value as EmailDeliveryTab;
      setTab(nextTab);
      syncQueryParams({ tab: nextTab });
    },
    [syncQueryParams],
  );

  const handleRestaurantChange = useCallback(
    (nextRestaurantId: string) => {
      if (!membershipIds.has(nextRestaurantId)) return;
      setActiveRestaurantId(nextRestaurantId);
      setTab(initialTab);
      setRange(initialRange);
      setStatuses(initialStatuses);
      setPage(initialPage);
      setPageSize(initialPageSize);
      setSimulateEmailDeliveryError(initialSimulateEmailDeliveryError);
      setRecipientEmail(initialRecipientEmail);
      setMessageId(initialMessageId);
      setBookingRef(initialBookingRef);
      setTemplateType(initialTemplateType);
      setEmailType(initialEmailType);
      setSearchField(
        resolveSearchField({
          recipientEmail: initialRecipientEmail,
          messageId: initialMessageId,
          bookingRef: initialBookingRef,
        }),
      );
      setSearchValue(
        resolveSearchValue({
          recipientEmail: initialRecipientEmail,
          messageId: initialMessageId,
          bookingRef: initialBookingRef,
        }),
      );

      syncQueryParams({
        restaurantId: nextRestaurantId,
        range: initialRange,
        page: initialPage,
        pageSize: initialPageSize,
        statuses: initialStatuses,
        simulateEmailDeliveryError: initialSimulateEmailDeliveryError,
        recipientEmail: initialRecipientEmail,
        messageId: initialMessageId,
        bookingRef: initialBookingRef,
        templateType: initialTemplateType,
        emailType: initialEmailType,
        tab: initialTab,
      });
    },
    [
      initialBookingRef,
      initialEmailType,
      initialMessageId,
      initialPage,
      initialPageSize,
      initialRange,
      initialRecipientEmail,
      initialSimulateEmailDeliveryError,
      initialStatuses,
      initialTab,
      initialTemplateType,
      membershipIds,
      setActiveRestaurantId,
      syncQueryParams,
    ],
  );

  useEffect(() => {
    if (!effectiveRestaurantId) return;
    const currentRestaurantId = parsedFromQuery.restaurantId;
    if (!currentRestaurantId || currentRestaurantId === effectiveRestaurantId) return;

    setTab(initialTab);
    setRange(initialRange);
    setStatuses(initialStatuses);
    setPage(initialPage);
    setPageSize(initialPageSize);
    setSimulateEmailDeliveryError(initialSimulateEmailDeliveryError);
    setRecipientEmail(initialRecipientEmail);
    setMessageId(initialMessageId);
    setBookingRef(initialBookingRef);
    setTemplateType(initialTemplateType);
    setEmailType(initialEmailType);
    setSearchField(
      resolveSearchField({
        recipientEmail: initialRecipientEmail,
        messageId: initialMessageId,
        bookingRef: initialBookingRef,
      }),
    );
    setSearchValue(
      resolveSearchValue({
        recipientEmail: initialRecipientEmail,
        messageId: initialMessageId,
        bookingRef: initialBookingRef,
      }),
    );

    syncQueryParams({
      restaurantId: effectiveRestaurantId,
      range: initialRange,
      page: initialPage,
      pageSize: initialPageSize,
      statuses: initialStatuses,
      simulateEmailDeliveryError: initialSimulateEmailDeliveryError,
      recipientEmail: initialRecipientEmail,
      messageId: initialMessageId,
      bookingRef: initialBookingRef,
      templateType: initialTemplateType,
      emailType: initialEmailType,
      tab: initialTab,
    });
  }, [
    effectiveRestaurantId,
    parsedFromQuery.restaurantId,
    initialBookingRef,
    initialEmailType,
    initialMessageId,
    initialPage,
    initialPageSize,
    initialRange,
    initialRecipientEmail,
    initialSimulateEmailDeliveryError,
    initialStatuses,
    initialTab,
    initialTemplateType,
    syncQueryParams,
  ]);



  const query = useOpsEmailDeliveryFeed({
    restaurantId: effectiveRestaurantId,
    range,
    page,
    pageSize,
    status: statuses.length > 0 ? statuses : undefined,
    simulateEmailDeliveryError,
    recipientEmail: recipientEmail ?? undefined,
    messageId: messageId ?? undefined,
    bookingRef: bookingRef ?? undefined,
    templateType: templateType ?? undefined,
    emailType: emailType ?? undefined,
  });
  const analyticsQuery = useOpsEmailDeliverySummary({
    restaurantId: effectiveRestaurantId,
    range,
    simulateEmailDeliveryError,
    recipientEmail: recipientEmail ?? undefined,
    messageId: messageId ?? undefined,
    bookingRef: bookingRef ?? undefined,
    templateType: templateType ?? undefined,
    emailType: emailType ?? undefined,
  });

  const attempts = query.attempts ?? [];
  const summary = query.summary ?? null;
  const analyticsSummary = analyticsQuery.summary ?? null;
  const statusCounts = summary
    ? ({
        sent: summary.sent,
        delivered: summary.delivered,
        delivery_delayed: summary.deliveryDelayed,
        bounced: summary.bounced,
        complained: summary.complained,
        failed: summary.failed,
      } satisfies Partial<Record<EmailDeliveryStatus, number>>)
    : null;

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchValue.trim();
    const nextRecipientEmail = searchField === 'recipientEmail' && trimmed ? trimmed.toLowerCase() : null;
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
      setPage(1);
      const next = enabled
        ? Array.from(new Set([...statuses, status]))
        : statuses.filter((s) => s !== status);
      setStatuses(next);
      syncQueryParams({ statuses: next, page: 1 });
    },
    [statuses, syncQueryParams],
  );

  const handlePrev = useCallback(() => {
    const next = Math.max(1, page - 1);
    if (next === page) return;
    setPage(next);
    syncQueryParams({ page: next });
  }, [page, syncQueryParams]);

  const handleNext = useCallback(() => {
    if (!query.response || query.response.ok === false) return;
    if (!query.response.pageInfo.hasNext) return;
    const next = page + 1;
    setPage(next);
    syncQueryParams({ page: next });
  }, [page, query.response, syncQueryParams]);

  const pageInfo = query.response && query.response.ok ? query.response.pageInfo : null;
  const currentPage = pageInfo?.page ?? page;
  const currentPageSize = pageInfo?.pageSize ?? pageSize;
  const totalResults = summary?.total ?? 0;
  const shouldShowPagination = currentPage > 1 || totalResults > 0 || currentPageSize !== 50;
  const hasPrevPage = currentPage > 1;
  const hasNextPage = Boolean(pageInfo?.hasNext);
  const rawStartResult = totalResults > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;
  const hasVisibleRows = attempts.length > 0 && totalResults > 0;
  const startResult = hasVisibleRows ? Math.min(rawStartResult, totalResults) : 0;
  const endResult = hasVisibleRows ? Math.min(totalResults, rawStartResult + attempts.length - 1) : 0;
  const deliveryLogErrorMessage = query.apiError
    ? getDeliveryFeedErrorMessage(query.apiError)
    : query.error
      ? getDeliveryFeedErrorMessage(query.error)
      : null;
  const [stuckLoadingFallbackActive, setStuckLoadingFallbackActive] = useState(false);

  useEffect(() => {
    if (!query.isLoading) {
      setStuckLoadingFallbackActive(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStuckLoadingFallbackActive(true);
    }, DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query.isLoading]);

  const shouldShowStuckLoadingAlert =
    stuckLoadingFallbackActive &&
    (simulateEmailDeliveryError || messageId === DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID);
  const stuckLoadingFallbackMessage = shouldShowStuckLoadingAlert
    ? 'The delivery log is taking longer than expected to settle after the forced error response. Retry to request the latest state again.'
    : 'The delivery log is taking longer than expected to settle. Try again or adjust the filters to recover the latest results.';
  const effectiveDeliveryLogErrorMessage =
    deliveryLogErrorMessage ?? (shouldShowStuckLoadingAlert ? stuckLoadingFallbackMessage : null);
  const shouldShowEmptyGuidance =
    !query.unavailable &&
    !effectiveDeliveryLogErrorMessage &&
    (!query.isLoading || stuckLoadingFallbackActive) &&
    attempts.length === 0;
  const canInjectDeliveryLogError =
    typeof window !== 'undefined' &&
    pathname?.includes('/dev/') &&
    (process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'test');

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
        <OpsEmptyState
          title="No restaurant access yet"
          description="Ask an owner or manager to send you an invitation so you can manage bookings."
          action={
            <Button asChild variant="secondary">
              <Link href="/guest/dashboard" prefetch={false}>
                Back to dashboard
              </Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <OpsPageHeader
        title="Email Delivery"
        subtitle="Deliverability dashboard for booking emails (Resend)."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {availableRestaurants.length > 1 ? (
              <Select value={effectiveRestaurantId ?? ''} onValueChange={handleRestaurantChange}>
                <SelectTrigger
                  className="h-8 w-[240px]"
                  aria-label="Restaurant switcher"
                >
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {availableRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : restaurantDetails.data ? (
              <Badge variant="outline" className="text-xs">
                {restaurantDetails.data.name}
              </Badge>
            ) : null}
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              {timezone}
            </Badge>
          </div>
        }
        secondaryActions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/bookings" prefetch={false}>
              Go to bookings
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="mt-6">
        <TabsList>
          <TabsTrigger value="delivery-log">Delivery Log</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery-log">
          <OpsPageToolbar className="space-y-4">
            {canInjectDeliveryLogError ? (
              <Alert className="border-dashed border-slate-300/80 bg-slate-50/80">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertTitle>Dev/test validation control</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    To surface the Delivery Log error alert for validation, append
                    {' '}
                    <code>messageId={DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID}</code>
                    {' '}
                    to this dev harness URL or choose Message ID in the search field and submit that exact value.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This fault injection path is only enabled for dev/test contexts and is ignored on production surfaces.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
            <OpsEmailDeliveryFilterBar
              searchField={searchField}
              searchValue={searchValue}
              onSearchFieldChange={setSearchField}
              onSearchValueChange={setSearchValue}
              onSubmitSearch={handleSubmitSearch}
              range={range}
              onRangeChange={(next) => {
                setRange(next);
                setPage(1);
                syncQueryParams({ range: next, page: 1 });
              }}
              templateType={templateType}
              onTemplateTypeChange={(next) => {
                setTemplateType(next);
                setPage(1);
                syncQueryParams({ templateType: next, page: 1 });
              }}
              emailType={emailType}
              onEmailTypeChange={(next) => {
                setEmailType(next);
                setPage(1);
                syncQueryParams({ emailType: next, page: 1 });
              }}
              statuses={statuses}
              statusCounts={statusCounts}
              onToggleStatus={toggleStatus}
              onClear={() => {
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
                syncQueryParams({
                  range: '7d',
                  page: 1,
                  statuses: [],
                  simulateEmailDeliveryError: false,
                  recipientEmail: null,
                  messageId: null,
                  bookingRef: null,
                  templateType: null,
                  emailType: null,
                });
              }}
            />
          </OpsPageToolbar>

          <section className="mt-4 space-y-4">
            {query.unavailable ? (
              <Alert className="border-amber-200/70 bg-amber-50/60">
                <MailWarning className="h-4 w-4" aria-hidden />
                <AlertTitle>Delivery tracking unavailable</AlertTitle>
                <AlertDescription>
                  This environment is not currently recording or exposing delivery events. Email sending can still work normally.
                </AlertDescription>
              </Alert>
            ) : effectiveDeliveryLogErrorMessage ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertTitle>Unable to load email delivery attempts</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{effectiveDeliveryLogErrorMessage}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-destructive underline-offset-4 hover:underline"
                    onClick={() => {
                      void query.refetch();
                    }}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <OpsEmailDeliveryTable
                attempts={attempts}
                timezone={timezone}
                restaurantId={effectiveRestaurantId ?? ''}
                isLoading={query.isLoading}
              />
            )}

            {shouldShowEmptyGuidance ? (
              <div className="rounded-lg border border-slate-200/60 bg-white p-8 text-center">
                <p className="text-base font-semibold text-slate-900">No email deliveries found</p>
                <p className="mt-2 text-sm text-slate-600">
                  Adjust the filters or try a wider date range to see more results.
                </p>
              </div>
            ) : null}

            {/* Pagination */}
            {shouldShowPagination && (
              <div className="flex flex-col gap-3 rounded-lg border border-slate-200/60 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-slate-900">
                    Showing {startResult}-{endResult} of {totalResults} results
                  </p>
                  <p className="text-xs text-muted-foreground">Page {currentPage}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(currentPageSize)}
                      onValueChange={(value) => {
                        const nextPageSize = Number.parseInt(value, 10);
                        if (!Number.isFinite(nextPageSize) || nextPageSize === pageSize) return;
                        setPageSize(nextPageSize);
                        setPage(1);
                        syncQueryParams({ page: 1, pageSize: nextPageSize });
                      }}
                    >
                      <SelectTrigger className="h-9 w-[88px]" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrev} disabled={!hasPrevPage}>
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      Prev
                    </Button>
                    <span className="min-w-16 text-center text-xs text-muted-foreground">
                      Page {currentPage}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasNextPage}>
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="queue">
          <OpsEmailQueuePanel restaurantId={effectiveRestaurantId} timezone={timezone} />
        </TabsContent>

        <TabsContent value="analytics">
          <OpsEmailDeliveryAnalytics
            summary={analyticsSummary}
            isLoading={analyticsQuery.isLoading}
            isUpdating={analyticsQuery.isFetching && !analyticsQuery.isLoading}
            range={range}
            onRangeChange={(next) => {
              setRange(next);
              setPage(1);
              syncQueryParams({ range: next, page: 1 });
            }}
            errorMessage={
              analyticsQuery.apiError
                ? getDeliveryFeedErrorMessage(analyticsQuery.apiError)
                : analyticsQuery.error
                  ? getDeliveryFeedErrorMessage(analyticsQuery.error)
                  : null
            }
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
