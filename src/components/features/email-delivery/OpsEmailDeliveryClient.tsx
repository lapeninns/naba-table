'use client';

import { MailWarning } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { OpsEmailDeliveryFiltersCard } from '@/components/features/email-delivery/components/OpsEmailDeliveryFiltersCard';
import { OpsEmailDeliveryResultsCard } from '@/components/features/email-delivery/components/OpsEmailDeliveryResultsCard';
import { OpsEmailDeliverySummaryMetrics } from '@/components/features/email-delivery/components/OpsEmailDeliverySummaryMetrics';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsEmailDeliveryFeed } from '@/hooks/ops/useOpsEmailDeliveryFeed';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { EMAIL_DELIVERY_STATUS_VALUES } from '@/types/emailDelivery';
import { parseEmailDeliverySearch } from '@src/lib/email-delivery/search';

import type {
  EmailDeliveryStatus,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

const EMPTY_STATUSES: EmailDeliveryStatus[] = [];

export type OpsEmailDeliveryClientProps = {
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

export function OpsEmailDeliveryClient({
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = EMPTY_STATUSES,
  initialRecipientEmail = null,
  initialMessageId = null,
  initialBookingRef = null,
  initialTemplateType = null,
  initialEmailType = null,
}: OpsEmailDeliveryClientProps) {
  const router = useRouter();
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
  const membershipIds = useMemo(() => new Set(memberships.map((m) => m.restaurantId)), [memberships]);

  const searchKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);

  const parsedFromQuery = useMemo(() => {
    const sp = new URLSearchParams(searchKey);
    const restaurantIdParam = parseUuid(sp.get('restaurantId')) ?? initialRestaurantId;
    const rangeParam = parseRange(sp.get('range'), initialRange);
    const pageParam = Math.max(1, parseIntParam(sp.get('page'), initialPage));
    const pageSizeParam = Math.max(1, Math.min(200, parseIntParam(sp.get('pageSize'), initialPageSize)));
    const statuses = parseStatuses(sp.get('status'), initialStatuses);

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
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const [range, setRange] = useState<OpsEmailDeliveryRange>(parsedFromQuery.range);
  const [statuses, setStatuses] = useState<EmailDeliveryStatus[]>(parsedFromQuery.statuses);
  const [page, setPage] = useState<number>(parsedFromQuery.page);
  const [pageSize] = useState<number>(parsedFromQuery.pageSize);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(parsedFromQuery.recipientEmail);
  const [messageId, setMessageId] = useState<string | null>(parsedFromQuery.messageId);
  const [bookingRef, setBookingRef] = useState<string | null>(parsedFromQuery.bookingRef);
  const [templateType, setTemplateType] = useState<string | null>(parsedFromQuery.templateType);
  const [emailType, setEmailType] = useState<string | null>(parsedFromQuery.emailType);

  const [searchValue, setSearchValue] = useState(() =>
    resolveSearchValue({ recipientEmail, messageId, bookingRef }),
  );

  // Keep local state in sync with URL when navigating via back/forward or external links.
  useEffect(() => {
    setRange(parsedFromQuery.range);
    setStatuses(parsedFromQuery.statuses);
    setPage(parsedFromQuery.page);
    setRecipientEmail(parsedFromQuery.recipientEmail);
    setMessageId(parsedFromQuery.messageId);
    setBookingRef(parsedFromQuery.bookingRef);
    setTemplateType(parsedFromQuery.templateType);
    setEmailType(parsedFromQuery.emailType);
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
      recipientEmail?: string | null;
      messageId?: string | null;
      bookingRef?: string | null;
      templateType?: string | null;
      emailType?: string | null;
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

      const statusValue = next.statuses && next.statuses.length > 0 ? next.statuses.join(',') : null;
      applyParam('status', statusValue);
      applyParam('recipientEmail', next.recipientEmail ?? recipientEmail);
      applyParam('messageId', next.messageId ?? messageId);
      applyParam('bookingRef', next.bookingRef ?? bookingRef);
      applyParam('templateType', next.templateType ?? templateType);
      applyParam('emailType', next.emailType ?? emailType);

      const current = searchParams?.toString() ?? '';
      const nextString = params.toString();
      if (current === nextString) return;

      router.replace(`${targetPath}${nextString ? `?${nextString}` : ''}`, { scroll: false });
    },
    [
      bookingRef,
      effectiveRestaurantId,
      emailType,
      messageId,
      page,
      pageSize,
      range,
      recipientEmail,
      router,
      searchParams,
      targetPath,
      templateType,
    ],
  );

  // Ensure the URL is always shareable once we know the effective restaurant id.
  useEffect(() => {
    if (!effectiveRestaurantId) return;
    const current = new URLSearchParams(searchParams?.toString() ?? '');
    const existing = current.get('restaurantId');
    if (existing !== effectiveRestaurantId) {
      current.set('restaurantId', effectiveRestaurantId);
      router.replace(`${targetPath}?${current.toString()}`, { scroll: false });
    }
  }, [effectiveRestaurantId, router, searchParams, targetPath]);

  const query = useOpsEmailDeliveryFeed({
    restaurantId: effectiveRestaurantId,
    range,
    page,
    pageSize,
    status: statuses.length > 0 ? statuses : undefined,
    recipientEmail: recipientEmail ?? undefined,
    messageId: messageId ?? undefined,
    bookingRef: bookingRef ?? undefined,
    templateType: templateType ?? undefined,
    emailType: emailType ?? undefined,
  });

  const attempts = query.attempts ?? [];
  const summary = query.summary ?? null;
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
    const parsed = parseEmailDeliverySearch(searchValue);
    const nextRecipientEmail = parsed.recipientEmail ?? null;
    const nextMessageId = parsed.messageId ?? null;
    const nextBookingRef = parsed.bookingRef ?? null;

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
  }, [searchValue, syncQueryParams]);

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

  const filterStatusFromMetrics = useCallback(
    (status: EmailDeliveryStatus | null) => {
      setPage(1);
      const next = status
        ? statuses.length === 1 && statuses[0] === status
          ? []
          : [status]
        : [];
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
          restaurantDetails.data ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {restaurantDetails.data.name}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                {timezone}
              </Badge>
            </div>
          ) : (
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              {timezone}
            </Badge>
          )
        }
        secondaryActions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/bookings" prefetch={false}>
              Go to bookings
            </Link>
          </Button>
        }
      />

      <OpsPageToolbar className="mt-6 space-y-4">
        <OpsEmailDeliveryFiltersCard
          range={range}
          statuses={statuses}
          statusCounts={statusCounts}
          searchValue={searchValue}
          templateType={templateType}
          emailType={emailType}
          onSearchValueChange={setSearchValue}
          onSubmitSearch={handleSubmitSearch}
          onRangeChange={(next) => {
            setRange(next);
            setPage(1);
            syncQueryParams({ range: next, page: 1 });
          }}
          onToggleStatus={toggleStatus}
          onTemplateTypeChange={setTemplateType}
          onTemplateTypeCommit={(next) => {
            setTemplateType(next);
            setPage(1);
            syncQueryParams({ templateType: next, page: 1 });
          }}
          onEmailTypeChange={setEmailType}
          onEmailTypeCommit={(next) => {
            setEmailType(next);
            setPage(1);
            syncQueryParams({ emailType: next, page: 1 });
          }}
          onClear={() => {
            setSearchValue('');
            setRecipientEmail(null);
            setMessageId(null);
            setBookingRef(null);
            setTemplateType(null);
            setEmailType(null);
            setStatuses([]);
            setRange('7d');
            setPage(1);
            syncQueryParams({
              range: '7d',
              page: 1,
              statuses: [],
              recipientEmail: null,
              messageId: null,
              bookingRef: null,
              templateType: null,
              emailType: null,
            });
          }}
        />
      </OpsPageToolbar>

      <section className="mt-6 space-y-4">
        {query.unavailable ? (
          <Alert className="border-amber-200/70 bg-amber-50/60">
            <MailWarning className="h-4 w-4" aria-hidden />
            <AlertTitle>Delivery tracking unavailable</AlertTitle>
            <AlertDescription>
              This environment is not currently recording or exposing delivery events. Email sending can still work normally.
            </AlertDescription>
          </Alert>
        ) : query.apiError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load email delivery attempts</AlertTitle>
            <AlertDescription>{query.apiError.error}</AlertDescription>
          </Alert>
        ) : query.error ? (
          <Alert variant="destructive">
            <AlertTitle>Unexpected error</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <OpsEmailDeliverySummaryMetrics
              summary={summary}
              isLoading={query.isSummaryLoading}
              isUpdating={query.isSummaryUpdating}
              onFilterStatus={filterStatusFromMetrics}
            />

            {query.isLoading && attempts.length === 0 ? (
              <div className="space-y-2" aria-label="Loading email delivery attempts">
                <Card className="border-slate-200/60 bg-white">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-[65%]" />
                    <Skeleton className="h-3 w-[90%]" />
                    <Skeleton className="h-3 w-[80%]" />
                  </CardContent>
                </Card>
                <Card className="border-slate-200/60 bg-white">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-[55%]" />
                    <Skeleton className="h-3 w-[92%]" />
                    <Skeleton className="h-3 w-[70%]" />
                  </CardContent>
                </Card>
                <Card className="border-slate-200/60 bg-white">
                  <CardContent className="p-4 space-y-2">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-3 w-[88%]" />
                    <Skeleton className="h-3 w-[75%]" />
                  </CardContent>
                </Card>
              </div>
            ) : attempts.length === 0 ? (
              <Card className="border-slate-200/60 bg-white">
                <CardContent className="p-4">
                  <div className="text-sm text-slate-600">No email attempts in this time range.</div>
                </CardContent>
              </Card>
            ) : (
              <OpsEmailDeliveryResultsCard
                attempts={attempts}
                timezone={timezone}
                restaurantId={effectiveRestaurantId ?? ''}
                page={page}
                hasNext={Boolean(query.response && query.response.ok && query.response.pageInfo.hasNext)}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            )}
          </>
        )}
      </section>
    </main>
  );
}
