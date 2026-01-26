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
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsEmailStatus } from '@/hooks/ops/useOpsEmailStatus';
import { useToast } from '@/hooks/use-toast';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { EMAIL_JOB_TYPES } from '@/lib/queue/email-types';
import { DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES } from '@/utils/ops/bookings';

import type { OpsEmailJobState, OpsEmailStatusEntry, OpsEmailStatusItem } from '@/types/ops';

type EmailStateFilter = 'all' | OpsEmailJobState;

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

const WINDOW_OPTIONS = [60, 90, 120, 180, 240, 360];

const STATE_OPTIONS: { value: EmailStateFilter; label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'active', label: 'Active' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'failed', label: 'Failed' },
  { value: 'none', label: 'None' },
  { value: 'unknown', label: 'Unknown' },
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

    const safeWindow = Number.isFinite(windowParam) ? windowParam : DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES;
    const safeType = typeParam && EMAIL_JOB_TYPES.includes(typeParam as (typeof EMAIL_JOB_TYPES)[number])
      ? typeParam
      : 'all';
    const safeState = stateParam && STATE_OPTIONS.some((option) => option.value === stateParam)
      ? (stateParam as EmailStateFilter)
      : 'all';

    return {
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      windowMinutes: safeWindow,
      type: safeType,
      state: safeState,
    };
  }, [searchParamsKey]);

  const [page, setPage] = useState(parsedFromQuery.page);
  const [windowMinutes, setWindowMinutes] = useState(parsedFromQuery.windowMinutes);
  const [typeFilter, setTypeFilter] = useState(parsedFromQuery.type);
  const [stateFilter, setStateFilter] = useState<EmailStateFilter>(parsedFromQuery.state);

  useEffect(() => {
    setPage(parsedFromQuery.page);
    setWindowMinutes(parsedFromQuery.windowMinutes);
    setTypeFilter(parsedFromQuery.type);
    setStateFilter(parsedFromQuery.state);
  }, [parsedFromQuery]);

  const syncQueryParams = useCallback(
    (next: { page?: number; windowMinutes?: number; type?: string; state?: EmailStateFilter }) => {
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

      applyParam('page', next.page ?? 1, 1);
      applyParam('windowMinutes', next.windowMinutes, DEFAULT_OPS_BOOKINGS_WINDOW_MINUTES);
      applyParam('type', next.type, 'all');
      applyParam('state', next.state, 'all');

      router.replace(`${opsBasePath}/email-status?${params.toString()}`);
    },
    [isOnline, opsBasePath, router, searchParams],
  );

  useEffect(() => {
    if (parsedFromQuery.page !== page) {
      setPage(parsedFromQuery.page);
    }
  }, [page, parsedFromQuery.page]);

  const appliedType = typeFilter === 'all' ? undefined : (typeFilter as (typeof EMAIL_JOB_TYPES)[number]);

  const emailStatusQuery = useOpsEmailStatus(
    activeRestaurantId
      ? {
          restaurantId: activeRestaurantId,
          page,
          pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
          windowMinutes,
          type: appliedType,
        }
      : null,
  );

  const rows = useMemo(() => {
    const items = emailStatusQuery.data?.items ?? [];
    const flat = flattenRows(items);
    if (stateFilter === 'all') return flat;
    return flat.filter((row) => row.entry.state === stateFilter);
  }, [emailStatusQuery.data?.items, stateFilter]);

  const handleRefresh = useCallback(() => {
    emailStatusQuery.refetch().catch((error) => {
      toast({
        title: 'Failed to refresh',
        description: error instanceof Error ? error.message : 'Unable to refresh email status',
        variant: 'destructive',
      });
    });
  }, [emailStatusQuery, toast]);

  useEffect(() => {
    syncQueryParams({ page, windowMinutes, type: typeFilter, state: stateFilter });
  }, [page, windowMinutes, typeFilter, stateFilter, syncQueryParams]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ops</p>
          <h1 className="text-2xl font-semibold text-foreground">Email status</h1>
          <p className="text-sm text-muted-foreground">
            Track queued, delayed, and failed emails for active bookings.
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

      <Card className="flex flex-col gap-4 border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px]">
            <Select value={String(windowMinutes)} onValueChange={(value) => setWindowMinutes(Number(value))}>
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
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value)}>
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
            <Select value={stateFilter} onValueChange={(value) => setStateFilter(value as EmailStateFilter)}>
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
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No email jobs found for this window.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={`${row.bookingId}-${row.entry.type}-${row.entry.jobId ?? 'none'}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {row.customerName ?? 'Guest'}
                        </span>
                        <span className="text-xs text-muted-foreground">{row.customerEmail ?? 'No email'}</span>
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
                      <Badge variant={stateBadgeVariant(row.entry.state)}>{formatStateLabel(row.entry.state)}</Badge>
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
    </div>
  );
}
