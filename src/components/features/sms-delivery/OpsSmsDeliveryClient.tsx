'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, MessageSquare, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';
import {
  formatSmsDeliveryOccurredAt,
  formatSmsTypeLabel,
  getSmsDeliveryStatusBadgeTone,
  SMS_DELIVERY_STATUS_LABELS,
} from '@/src/lib/sms-delivery/presentation';
import {
  SMS_DELIVERY_STALE_THRESHOLD_HOURS,
  type OpsSmsDeliveryRange,
  type SmsDeliveryStatus,
} from '@/types/smsDelivery';

function formatSmsStuckForHint(stuckForMs: number | null | undefined): string | null {
  if (typeof stuckForMs !== 'number' || !Number.isFinite(stuckForMs) || stuckForMs <= 0)
    return null;
  const mins = Math.floor(stuckForMs / 60000);
  if (mins >= 120) {
    const hours = Math.floor(mins / 60);
    return `stuck ${hours}h`;
  }
  return `stuck ${Math.max(1, mins)}m`;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const RANGE_OPTIONS: Array<{ value: OpsSmsDeliveryRange; label: string }> = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

type OpsSmsDeliveryClientProps = {
  initialRestaurantId?: string | null;
  initialRange?: OpsSmsDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: SmsDeliveryStatus[];
};

function StatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const tone = getSmsDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}
    >
      {SMS_DELIVERY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function OpsSmsDeliveryClient({
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = [],
}: OpsSmsDeliveryClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { bookingService, restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );

  const [restaurantId, setRestaurantId] = useState<string | null>(() => {
    if (initialRestaurantId && membershipIds.has(initialRestaurantId)) return initialRestaurantId;
    return activeRestaurantId ?? memberships[0]?.restaurantId ?? null;
  });
  const [range, setRange] = useState<OpsSmsDeliveryRange>(initialRange);
  const [page, setPage] = useState<number>(Math.max(1, initialPage));
  const [pageSize, setPageSize] = useState<number>(Math.max(1, Math.min(200, initialPageSize)));
  const [selectedStatuses, setSelectedStatuses] = useState<SmsDeliveryStatus[]>(initialStatuses);
  const [availableRestaurants, setAvailableRestaurants] = useState<
    Array<{ id: string; name: string; timezone?: string | null }>
  >([]);

  useEffect(() => {
    if (!restaurantId && memberships.length > 0) {
      setRestaurantId(memberships[0]?.restaurantId ?? null);
    }
  }, [memberships, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    if (restaurantId !== activeRestaurantId) {
      setActiveRestaurantId(restaurantId);
    }
  }, [activeRestaurantId, restaurantId, setActiveRestaurantId]);

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

  const restaurantDetails = useOpsRestaurantDetails(restaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const feedQuery = useQuery({
    queryKey: [
      'ops',
      'sms-delivery',
      restaurantId ?? 'none',
      range,
      page,
      pageSize,
      selectedStatuses.join(','),
    ],
    queryFn: () =>
      bookingService.getRestaurantSmsDeliveryFeed({
        restaurantId: restaurantId ?? undefined,
        range,
        page,
        pageSize,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      }),
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });

  const feed = feedQuery.data && feedQuery.data.ok ? feedQuery.data : null;
  const unavailable =
    feedQuery.data && !feedQuery.data.ok && feedQuery.data.code === 'DELIVERY_LOG_UNAVAILABLE';
  const apiError =
    feedQuery.data && !feedQuery.data.ok && feedQuery.data.code !== 'DELIVERY_LOG_UNAVAILABLE'
      ? feedQuery.data.error
      : null;

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
        <OpsEmptyState
          title="No restaurant access yet"
          description="Ask an owner or manager to send you an invitation so you can manage bookings."
          action={
            <Button asChild variant="secondary">
              <Link href={opsHref('/dashboard')} prefetch={false}>
                Return to ops home
              </Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <OpsPageShell variant="standard" className="space-y-4">
      <OpsPageHeader
        title="SMS Delivery"
        subtitle="Track queued/sent/delivered/failed booking SMS in one place."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {availableRestaurants.length > 1 ? (
              <Select
                value={restaurantId ?? ''}
                onValueChange={(value) => {
                  setRestaurantId(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-full sm:w-[240px]" aria-label="Restaurant switcher">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void feedQuery.refetch();
            }}
            disabled={feedQuery.isFetching}
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', feedQuery.isFetching && 'animate-spin')}
              aria-hidden
            />
            Refresh
          </Button>
        }
      />

      {feed && (feed.summary.stuckInFlight ?? 0) > 0 ? (
        <Alert className="mt-4 border-border bg-muted/40 text-foreground">
          <AlertTitle className="text-sm font-semibold">
            {feed.summary.stuckInFlight} SMS still awaiting terminal status
          </AlertTitle>
          <AlertDescription className="text-xs">
            These SMS attempts are still at <code>queued</code> or <code>sent</code> more than{' '}
            {SMS_DELIVERY_STALE_THRESHOLD_HOURS}h after Twilio accepted them. Twilio recommends
            polling the Message resource when a message has not reached <code>delivered</code> or{' '}
            <code>undelivered</code> within that window because a status callback may have been
            missed. Likely causes: a missed callback, carrier delay, or a message that never
            progressed beyond queueing/sending. Any row below flagged &ldquo;Stuck&rdquo; warrants
            Twilio log review or reconciliation.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {feedQuery.isLoading || !feed ? (
          <>
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total attempts</p>
                <p className="text-2xl font-semibold">{feed.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Delivered rate</p>
                <p className="text-2xl font-semibold">
                  {Math.round(feed.summary.deliveredRate * 100)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Failures</p>
                <p className="text-2xl font-semibold">
                  {feed.summary.failed + feed.summary.undelivered}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Unique recipients</p>
                <p className="text-2xl font-semibold">{feed.summary.uniqueRecipients}</p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <OpsPageToolbar
        sticky={false}
        filters={
          <>
            <Select
              value={range}
              onValueChange={(value) => {
                setRange(value as OpsSmsDeliveryRange);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[170px]" aria-label="Select date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant={selectedStatuses.length === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedStatuses([]);
                setPage(1);
              }}
            >
              All
            </Button>
            {(['queued', 'sent', 'delivered', 'undelivered', 'failed'] as const).map((status) => {
              const active = selectedStatuses.includes(status);
              return (
                <Button
                  key={status}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedStatuses((current) => {
                      const exists = current.includes(status);
                      return exists
                        ? current.filter((item) => item !== status)
                        : [...current, status];
                    });
                    setPage(1);
                  }}
                >
                  {SMS_DELIVERY_STATUS_LABELS[status]}
                </Button>
              );
            })}
          </>
        }
      />

      <section className="mt-4">
        {unavailable ? (
          <Alert className="border-border bg-muted/40">
            <AlertTitle>Delivery tracking unavailable</AlertTitle>
            <AlertDescription>
              This environment is not currently recording or exposing SMS delivery events.
            </AlertDescription>
          </Alert>
        ) : apiError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>Unable to load SMS delivery attempts</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        ) : feedQuery.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>Unexpected error</AlertTitle>
            <AlertDescription>{feedQuery.error.message}</AlertDescription>
          </Alert>
        ) : feed ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" aria-hidden />
                SMS Delivery Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feed.attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No SMS attempts found for this range/filter.
                </p>
              ) : (
                <div className="space-y-3">
                  {feed.attempts.map((attempt) => {
                    const isStale = attempt.isStale === true;
                    const stuckHint = isStale ? formatSmsStuckForHint(attempt.stuckForMs) : null;
                    return (
                      <div
                        key={`${attempt.messageSid}__${attempt.recipientPhone}`}
                        className={cn(
                          'rounded-lg border p-3',
                          isStale ? 'border-primary/30 bg-primary/10' : 'border-border',
                        )}
                        data-stale={isStale ? 'true' : undefined}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={attempt.currentStatus} />
                              {isStale ? (
                                <Badge
                                  variant="outline"
                                  className="border-primary/30 bg-primary/10 text-[10px] font-bold uppercase tracking-wide text-primary"
                                  title="In flight for longer than the expected Twilio callback window"
                                >
                                  Stuck{stuckHint ? ` · ${stuckHint}` : ''}
                                </Badge>
                              ) : null}
                              <span className="text-sm font-medium text-foreground">
                                {formatSmsTypeLabel(attempt.smsType)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {attempt.recipientPhone} ·{' '}
                              {attempt.booking?.reference
                                ? `Ref ${attempt.booking.reference}`
                                : 'No booking link'}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatSmsDeliveryOccurredAt(attempt.currentOccurredAt, timezone) ??
                              'Unknown time'}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {attempt.events.map((event) => (
                            <Badge key={event.id} variant="outline" className="text-[10px]">
                              {SMS_DELIVERY_STATUS_LABELS[event.status]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Page {feed.pageInfo.page}</p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!feed.pageInfo.hasNext}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </OpsPageShell>
  );
}
