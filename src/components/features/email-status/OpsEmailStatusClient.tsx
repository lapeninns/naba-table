'use client';

import { Loader2, RefreshCcw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { Pagination } from '@/components/dashboard/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsEmailStatus } from '@/hooks/ops/useOpsEmailStatus';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { EMAIL_DELIVERY_STATUSES } from '@/lib/emails/delivery-status';
import { EMAIL_JOB_TYPES } from '@/lib/queue/email-types';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES } from '@/utils/ops/bookings';

import type {
  OpsEmailDeliveryStatus,
  OpsEmailJobState,
  OpsEmailStatusEntry,
  OpsEmailStatusItem,
  OpsEmailStatusView,
} from '@/types/ops';

type EmailStateFilter = 'all' | OpsEmailJobState;
type DeliveryStatusFilter = 'all' | OpsEmailDeliveryStatus;
type DeliveryRangeKey = 'custom' | '7:7' | '30:30' | '30:0' | '90:0';

type EmailRow = {
  bookingId: string;
  restaurantName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  bookingStatus: string;
  startAt: string | null;
  endAt: string | null;
  entry: OpsEmailStatusEntry;
};

const WINDOW_OPTIONS = [60, 90, 120, 180, 240, 360, 720, 1440, 2880, 4320, 10080, 43200];
const DEFAULT_DELIVERY_RANGE: DeliveryRangeKey = '30:30';

const STATE_OPTIONS: { value: EmailStateFilter; label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'active', label: 'Active' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'failed', label: 'Failed' },
  { value: 'none', label: 'None' },
  { value: 'unknown', label: 'Unknown' },
];

const DELIVERY_STATUS_OPTIONS: { value: DeliveryStatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'delivery_delayed', label: 'Delayed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'failed', label: 'Failed' },
];

const DELIVERY_RANGE_OPTIONS: Array<{
  value: DeliveryRangeKey;
  label: string;
  pastDays: number;
  futureDays: number;
}> = [
  { value: '7:7', label: 'Past 7 / Next 7 days', pastDays: 7, futureDays: 7 },
  { value: '30:30', label: 'Past 30 / Next 30 days', pastDays: 30, futureDays: 30 },
  { value: '30:0', label: 'Past 30 days', pastDays: 30, futureDays: 0 },
  { value: '90:0', label: 'Past 90 days', pastDays: 90, futureDays: 0 },
];

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatTypeLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function formatStateLabel(value: OpsEmailJobState): string {
  switch (value) {
    case 'waiting':
      return 'Waiting';
    case 'active':
      return 'Active';
    case 'delayed':
      return 'Delayed';
    case 'failed':
      return 'Failed';
    case 'none':
      return 'None';
    case 'unknown':
      return 'Unknown';
    default:
      return value;
  }
}

function formatDeliveryStatusLabel(value: OpsEmailDeliveryStatus): string {
  switch (value) {
    case 'delivery_delayed':
      return 'Delayed';
    case 'complained':
      return 'Complained';
    default:
      return formatTypeLabel(value);
  }
}

function stateBadgeVariant(state: OpsEmailJobState): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case 'failed':
      return 'destructive';
    case 'delayed':
      return 'secondary';
    case 'active':
      return 'default';
    case 'waiting':
      return 'outline';
    case 'none':
      return 'outline';
    case 'unknown':
      return 'secondary';
    default:
      return 'secondary';
  }
}

function deliveryBadgeVariant(status: OpsEmailDeliveryStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'failed':
    case 'bounced':
    case 'complained':
      return 'destructive';
    case 'delivery_delayed':
      return 'secondary';
    case 'delivered':
      return 'default';
    case 'sent':
      return 'outline';
    default:
      return 'secondary';
  }
}

function buildRangeFromKey(rangeKey: DeliveryRangeKey): { from: string; to: string } {
  const selected =
    DELIVERY_RANGE_OPTIONS.find((option) => option.value === rangeKey) ??
    DELIVERY_RANGE_OPTIONS.find((option) => option.value === DEFAULT_DELIVERY_RANGE) ??
    DELIVERY_RANGE_OPTIONS[0];
  const now = new Date();
  const from = new Date(now.getTime() - selected.pastDays * 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + selected.futureDays * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function resolveRangeKey(fromValue: string | null, toValue: string | null): DeliveryRangeKey {
  if (!fromValue || !toValue) return DEFAULT_DELIVERY_RANGE;
  const from = new Date(fromValue);
  const to = new Date(toValue);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return DEFAULT_DELIVERY_RANGE;
  const now = new Date();
  const pastDays = Math.round((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const futureDays = Math.round((to.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const matched = DELIVERY_RANGE_OPTIONS.find(
    (option) => option.pastDays === pastDays && option.futureDays === futureDays,
  );
  return matched?.value ?? 'custom';
}

function flattenRows(items: OpsEmailStatusItem[]): EmailRow[] {
  return items.flatMap((item) =>
    item.entries.map((entry) => ({
      bookingId: item.bookingId,
      restaurantName: item.restaurantName,
      customerName: item.customerName,
      customerEmail: item.customerEmail,
      customerPhone: item.customerPhone,
      bookingStatus: item.status,
      startAt: item.startAt,
      endAt: item.endAt,
      entry,
    })),
  );
}

export function OpsEmailStatusClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const opsBasePath = pathname?.startsWith('/app') ? '/app' : '';
  const searchParamsKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const { activeRestaurantId } = useOpsSession();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const parsedFromQuery = useMemo(() => {
    const sp = new URLSearchParams(searchParamsKey);
    const pageParam = Number.parseInt(sp.get('page') ?? '1', 10);
    const windowParam = Number.parseInt(
      sp.get('windowMinutes') ?? String(DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES),
      10,
    );
    const typeParam = sp.get('type');
    const stateParam = sp.get('state');
    const statusParam = sp.get('status');
    const viewParam = sp.get('view');
    const fromParam = sp.get('from');
    const toParam = sp.get('to');

    const safeView: OpsEmailStatusView = viewParam === 'delivery' ? 'delivery' : 'queue';
    const safeWindow = Number.isFinite(windowParam) ? windowParam : DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;
    const safeType = typeParam && EMAIL_JOB_TYPES.includes(typeParam as (typeof EMAIL_JOB_TYPES)[number])
      ? typeParam
      : 'all';
    const safeState = stateParam && STATE_OPTIONS.some((option) => option.value === stateParam)
      ? (stateParam as EmailStateFilter)
      : 'all';
    const safeStatus =
      statusParam && EMAIL_DELIVERY_STATUSES.includes(statusParam as OpsEmailDeliveryStatus)
        ? (statusParam as OpsEmailDeliveryStatus)
        : 'all';

    const rangeKey = resolveRangeKey(fromParam, toParam);
    const fallbackRange = buildRangeFromKey(DEFAULT_DELIVERY_RANGE);
    const safeFrom = fromParam ?? fallbackRange.from;
    const safeTo = toParam ?? fallbackRange.to;

    return {
      view: safeView,
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      windowMinutes: safeWindow,
      queueType: safeType,
      queueState: safeState,
      deliveryStatus: safeStatus,
      deliveryType: safeType,
      deliveryRangeKey: rangeKey,
      deliveryFrom: safeFrom,
      deliveryTo: safeTo,
    };
  }, [searchParamsKey]);

  const [view, setView] = useState<OpsEmailStatusView>(parsedFromQuery.view);
  const [page, setPage] = useState(parsedFromQuery.page);
  const [windowMinutes, setWindowMinutes] = useState(parsedFromQuery.windowMinutes);
  const [queueTypeFilter, setQueueTypeFilter] = useState(parsedFromQuery.queueType);
  const [queueStateFilter, setQueueStateFilter] = useState<EmailStateFilter>(parsedFromQuery.queueState);
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState(parsedFromQuery.deliveryType);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>(
    parsedFromQuery.deliveryStatus,
  );
  const [deliveryRangeKey, setDeliveryRangeKey] = useState<DeliveryRangeKey>(
    parsedFromQuery.deliveryRangeKey,
  );
  const [deliveryFrom, setDeliveryFrom] = useState(parsedFromQuery.deliveryFrom);
  const [deliveryTo, setDeliveryTo] = useState(parsedFromQuery.deliveryTo);

  useEffect(() => {
    setView(parsedFromQuery.view);
    setPage(parsedFromQuery.page);
    setWindowMinutes(parsedFromQuery.windowMinutes);
    setQueueTypeFilter(parsedFromQuery.queueType);
    setQueueStateFilter(parsedFromQuery.queueState);
    setDeliveryTypeFilter(parsedFromQuery.deliveryType);
    setDeliveryStatusFilter(parsedFromQuery.deliveryStatus);
    setDeliveryRangeKey(parsedFromQuery.deliveryRangeKey);
    setDeliveryFrom(parsedFromQuery.deliveryFrom);
    setDeliveryTo(parsedFromQuery.deliveryTo);
  }, [parsedFromQuery]);

  const syncQueryParams = useCallback(
    (next: {
      view: OpsEmailStatusView;
      page?: number;
      windowMinutes?: number;
      type?: string;
      state?: EmailStateFilter;
      status?: DeliveryStatusFilter;
      from?: string;
      to?: string;
    }) => {
      if (!isOnline) return;

      const params = new URLSearchParams(searchParams?.toString() ?? '');

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
          params.delete(key);
          return;
        }
        params.set(key, String(value));
      };

      applyParam('view', next.view, 'queue');
      applyParam('page', next.page ?? 1, 1);

      if (next.view === 'queue') {
        applyParam('windowMinutes', next.windowMinutes, DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES);
        applyParam('type', next.type, 'all');
        applyParam('state', next.state, 'all');
        params.delete('status');
        params.delete('from');
        params.delete('to');
      } else {
        applyParam('type', next.type, 'all');
        applyParam('status', next.status, 'all');
        applyParam('from', next.from);
        applyParam('to', next.to);
        params.delete('windowMinutes');
        params.delete('state');
      }

      router.replace(`${opsBasePath}/email-status?${params.toString()}`);
    },
    [isOnline, opsBasePath, router, searchParams],
  );

  useEffect(() => {
    if (parsedFromQuery.page !== page) {
      setPage(parsedFromQuery.page);
    }
  }, [page, parsedFromQuery.page]);

  const appliedQueueType =
    queueTypeFilter === 'all' ? undefined : (queueTypeFilter as (typeof EMAIL_JOB_TYPES)[number]);
  const appliedDeliveryType =
    deliveryTypeFilter === 'all' ? undefined : (deliveryTypeFilter as (typeof EMAIL_JOB_TYPES)[number]);
  const appliedDeliveryStatus = deliveryStatusFilter === 'all' ? undefined : deliveryStatusFilter;

  const emailStatusQuery = useOpsEmailStatus(
    activeRestaurantId
      ? view === 'queue'
        ? {
            restaurantId: activeRestaurantId,
            view: 'queue',
            page,
            pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
            windowMinutes,
            type: appliedQueueType,
          }
        : {
            restaurantId: activeRestaurantId,
            view: 'delivery',
            page,
            pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
            type: appliedDeliveryType,
            status: appliedDeliveryStatus,
            from: deliveryFrom,
            to: deliveryTo,
          }
      : null,
  );

  const queueRows = useMemo(() => {
    if (emailStatusQuery.data?.view !== 'queue') return [];
    const items = emailStatusQuery.data.items ?? [];
    const flat = flattenRows(items);
    if (queueStateFilter === 'all') return flat;
    return flat.filter((row) => row.entry.state === queueStateFilter);
  }, [emailStatusQuery.data, queueStateFilter]);

  const deliveryRows = useMemo(() => {
    if (emailStatusQuery.data?.view !== 'delivery') return [];
    return emailStatusQuery.data.items ?? [];
  }, [emailStatusQuery.data]);

  const handleRefresh = useCallback(() => {
    emailStatusQuery.refetch().catch((error) => {
      toast({
        title: 'Failed to refresh',
        description: error instanceof Error ? error.message : 'Unable to refresh email status',
        variant: 'destructive',
      });
    });
  }, [emailStatusQuery, toast]);

  const handleViewChange = useCallback((nextView: string) => {
    setView(nextView as OpsEmailStatusView);
    setPage(1);
  }, []);

  const handleDeliveryRangeChange = useCallback((value: string) => {
    const nextKey = value as DeliveryRangeKey;
    setDeliveryRangeKey(nextKey);
    if (nextKey !== 'custom') {
      const { from, to } = buildRangeFromKey(nextKey);
      setDeliveryFrom(from);
      setDeliveryTo(to);
    }
    setPage(1);
  }, []);

  useEffect(() => {
    if (view === 'queue') {
      syncQueryParams({
        view,
        page,
        windowMinutes,
        type: queueTypeFilter,
        state: queueStateFilter,
      });
      return;
    }

    syncQueryParams({
      view,
      page,
      type: deliveryTypeFilter,
      status: deliveryStatusFilter,
      from: deliveryFrom,
      to: deliveryTo,
    });
  }, [
    view,
    page,
    windowMinutes,
    queueTypeFilter,
    queueStateFilter,
    deliveryTypeFilter,
    deliveryStatusFilter,
    deliveryFrom,
    deliveryTo,
    syncQueryParams,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ops</p>
          <h1 className="text-2xl font-semibold text-foreground">Email status</h1>
          <p className="text-sm text-muted-foreground">
            Track queue health and delivery outcomes for active bookings.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={handleRefresh}
          disabled={emailStatusQuery.isFetching}
        >
          {emailStatusQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </Button>
      </header>

      <Tabs value={view} onValueChange={handleViewChange} className="flex flex-col gap-4">
        <TabsList className="w-full justify-start gap-1 border-b border-border bg-transparent p-0">
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-0">
          <Card className="flex flex-col gap-4 border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px]">
                <Select
                  value={String(windowMinutes)}
                  onValueChange={(value) => {
                    setWindowMinutes(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Select time window">
                    <SelectValue placeholder="Time window" />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOW_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        ±{option} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Select
                  value={queueTypeFilter}
                  onValueChange={(value) => {
                    setQueueTypeFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Select email type">
                    <SelectValue placeholder="Email type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {EMAIL_JOB_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Select
                  value={queueStateFilter}
                  onValueChange={(value) => {
                    setQueueStateFilter(value as EmailStateFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Select email state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {emailStatusQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load email status</AlertTitle>
                <AlertDescription>
                  {emailStatusQuery.error?.message ?? 'Please try again.'}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Email type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailStatusQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        Loading email status…
                      </TableCell>
                    </TableRow>
                  ) : queueRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No email jobs found for this window.
                      </TableCell>
                    </TableRow>
                  ) : (
                    queueRows.map((row) => (
                      <TableRow key={`${row.bookingId}-${row.entry.type}-${row.entry.jobId ?? 'none'}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {row.customerName ?? 'Guest'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {row.customerEmail ?? 'No email'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span className="text-sm text-foreground">
                              {row.restaurantName ?? 'Restaurant'}
                            </span>
                            <span>{formatDateTime(row.startAt)}</span>
                            <span className="uppercase">{row.bookingStatus}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {formatTypeLabel(row.entry.type)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stateBadgeVariant(row.entry.state)}>
                            {formatStateLabel(row.entry.state)}
                          </Badge>
                          {row.entry.failedReason ? (
                            <p className="mt-1 max-w-[240px] text-xs text-destructive">
                              {row.entry.failedReason}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {row.entry.processAt ? formatDateTime(row.entry.processAt) : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={DASHBOARD_DEFAULT_PAGE_SIZE}
              total={emailStatusQuery.data?.pageInfo.total ?? 0}
              isLoading={emailStatusQuery.isFetching}
              onPageChange={setPage}
            />
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-0">
          <Card className="flex flex-col gap-4 border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <Select value={deliveryRangeKey} onValueChange={handleDeliveryRangeChange}>
                  <SelectTrigger aria-label="Select delivery range">
                    <SelectValue placeholder="Range" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Select
                  value={deliveryTypeFilter}
                  onValueChange={(value) => {
                    setDeliveryTypeFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Select delivery email type">
                    <SelectValue placeholder="Email type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {EMAIL_JOB_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px]">
                <Select
                  value={deliveryStatusFilter}
                  onValueChange={(value) => {
                    setDeliveryStatusFilter(value as DeliveryStatusFilter);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Select delivery status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {emailStatusQuery.isError ? (
              <Alert variant="destructive">
                <AlertTitle>Unable to load delivery events</AlertTitle>
                <AlertDescription>
                  {emailStatusQuery.error?.message ?? 'Please try again.'}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Email type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Occurred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailStatusQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        Loading delivery events…
                      </TableCell>
                    </TableRow>
                  ) : deliveryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No delivery events found for this range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliveryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">
                              {row.customerName ?? 'Guest'}
                            </span>
                            <span className="text-xs text-muted-foreground">{row.recipientEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span className="text-sm text-foreground">
                              {row.restaurantName ?? 'Restaurant'}
                            </span>
                            <span>{formatDateTime(row.startAt)}</span>
                            {row.bookingStatus ? (
                              <span className="uppercase">{row.bookingStatus}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {row.emailType ? formatTypeLabel(row.emailType) : row.templateType ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={deliveryBadgeVariant(row.status)}>
                            {formatDeliveryStatusLabel(row.status)}
                          </Badge>
                          {row.error ? (
                            <p className="mt-1 max-w-[240px] text-xs text-destructive">{row.error}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {row.occurredAt ? formatDateTime(row.occurredAt) : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={DASHBOARD_DEFAULT_PAGE_SIZE}
              total={emailStatusQuery.data?.pageInfo.total ?? 0}
              isLoading={emailStatusQuery.isFetching}
              onPageChange={setPage}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
