'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, TrendingUp, Users, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsActiveMembership, useOpsAccountSnapshot } from '@/contexts/ops-session';
import { useOpsTodaySummary, useOpsBookingStatusActions, useOpsCapacityUtilization, useOpsTodayVIPs, useOpsBookingChanges, useOpsBookingHeatmap } from '@/hooks';
import { formatDateKey, formatDateReadable, formatTimeRange } from '@/lib/utils/datetime';
import { cn } from '@/lib/utils';
import { sanitizeDateParam, computeCalendarRange } from '@/utils/ops/dashboard';

import { BookingChangeFeed } from './BookingChangeFeed';
import { BookingsFilterBar } from './BookingsFilterBar';
import { BookingsList } from './BookingsList';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { ExportBookingsButton } from './ExportBookingsButton';
import { VIPGuestsModule } from './VIPGuestsModule';
import { HeatmapCalendar } from './HeatmapCalendar';
import type { PeriodUtilization } from './CapacityVisualization';

import type { BookingFilter } from './BookingsFilterBar';


const DEFAULT_FILTER: BookingFilter = 'all';

type OpsDashboardClientProps = {
  initialDate: string | null;
};

export function OpsDashboardClient({ initialDate }: OpsDashboardClientProps) {
  const membership = useOpsActiveMembership();
  const account = useOpsAccountSnapshot();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<BookingFilter>(DEFAULT_FILTER);
  const [selectedDate, setSelectedDate] = useState<string | null>(sanitizeDateParam(initialDate ?? undefined));
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const restaurantId = membership?.restaurantId ?? null;
  const restaurantName = membership?.restaurantName ?? account.restaurantName ?? 'Restaurant';

  const summaryQuery = useOpsTodaySummary({ restaurantId, targetDate: selectedDate });
  const summary = summaryQuery.data ?? null;

  useEffect(() => {
    if (!summary) return;
    if (summary.date !== selectedDate) {
      setSelectedDate(summary.date);
    }
  }, [summary, selectedDate]);

  // Heatmap data for modified calendar popover
  const heatmapRange = useMemo(() => (summary ? computeCalendarRange(summary.date) : null), [summary]);
  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange),
  });

  const capacityQuery = useOpsCapacityUtilization({
    restaurantId,
    targetDate: selectedDate,
    enabled: Boolean(restaurantId && selectedDate),
  });

  const vipsQuery = useOpsTodayVIPs({
    restaurantId,
    targetDate: selectedDate,
    enabled: Boolean(restaurantId && selectedDate),
  });

  const changesQuery = useOpsBookingChanges({
    restaurantId,
    targetDate: selectedDate,
    enabled: Boolean(restaurantId && selectedDate),
  });

  const bookingStatusMutation = useOpsBookingStatusActions();

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (date) {
      params.set('date', date);
    } else {
      params.delete('date');
    }

    startTransition(() => {
      router.replace(`/ops${params.size > 0 ? `?${params.toString()}` : ''}`);
    });
  };

  const handleShiftDate = (days: number) => {
    const baseDate = selectedDate ?? summary?.date ?? null;
    if (!baseDate) return;
    const nextDate = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(nextDate.getTime())) return;
    nextDate.setDate(nextDate.getDate() + days);
    handleSelectDate(formatDateKey(nextDate));
  };

  const statCards = useMemo(() => {
    const totals = summary?.totals;
    if (!totals) {
      return [];
    }

    return [
      {
        id: 'total',
        title: 'Bookings',
        value: totals.total ?? 0,
        icon: CalendarIcon,
        accentBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
      },
      {
        id: 'upcoming',
        title: 'Upcoming',
        value: totals.upcoming ?? 0,
        icon: Clock,
        accentBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
      },
      {
        id: 'completed',
        title: 'Shows',
        value: totals.completed ?? 0,
        icon: Users,
        accentBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
      },
      {
        id: 'noShow',
        title: 'No Shows',
        value: totals.noShow ?? 0,
        icon: TrendingUp,
        accentBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
      },
    ] as StatCardConfig[];
  }, [summary?.totals]);

  const servicePeriods = capacityQuery.data?.periods ?? [];
  const hasServiceCapacity = capacityQuery.isLoading || servicePeriods.length > 0;

  const handleStatusChange = async (bookingId: string, status: 'completed' | 'no_show') => {
    if (!restaurantId) return;
    setPendingBookingId(bookingId);
    try {
      await bookingStatusMutation.mutateAsync({ restaurantId, bookingId, status, targetDate: summary?.date });
    } finally {
      setPendingBookingId(null);
    }
  };

  if (!restaurantId) {
    return <NoAccessState />;
  }

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryQuery.isError || !summary) {
    return <DashboardErrorState onRetry={() => summaryQuery.refetch()} />;
  }

  const serviceDateLabel = formatDateReadable(summary.date, summary.timezone);
  const changeFeedData = changesQuery.data?.changes ?? [];
  const changeFeedTotal = changesQuery.data?.totalChanges ?? 0;
  const showChangeFeed = changeFeedData.length > 0;
  const vipData = vipsQuery.data;
  const showVipModule = Boolean(vipData && vipData.vips.length > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">Operations Dashboard</h1>
          <p className="text-sm text-slate-600">{restaurantName}</p>
        </header>

        <section
          aria-label="Service date"
          className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <CalendarIcon className="h-5 w-5 text-slate-600" aria-hidden />
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service Date</p>
                {/* Modified: keep heatmap calendar via popover trigger for quick date change */}
                <HeatmapCalendar
                  summary={summary}
                  heatmap={heatmapQuery.data}
                  selectedDate={summary.date}
                  onSelectDate={handleSelectDate}
                  isLoading={heatmapQuery.isLoading}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DateNavigationButton direction="prev" onClick={() => handleShiftDate(-1)} />
              <DateNavigationButton direction="next" onClick={() => handleShiftDate(1)} />
            </div>
          </div>
        </section>

        {statCards.length > 0 ? (
          <section aria-label="Key performance indicators">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <StatCard key={card.id} config={card} />
              ))}
            </div>
          </section>
        ) : null}

        {hasServiceCapacity ? (
          <section
            aria-label="Service capacity"
            className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Service Capacity</h2>
              {capacityQuery.data?.hasOverbooking ? (
                <span className="text-xs font-semibold text-rose-600">Overbooked</span>
              ) : null}
            </div>
            {capacityQuery.isLoading ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[0, 1].map((key) => (
                  <Skeleton key={key} className="h-24 rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : servicePeriods.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {servicePeriods.map((period) => (
                  <ServicePeriodCard key={period.periodId} period={period} timezone={summary.timezone} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No service periods configured yet. Update restaurant settings to track utilization.
              </p>
            )}
          </section>
        ) : null}

        <section
          aria-label="Reservations"
          className="rounded-2xl border border-white/60 bg-white/90 shadow-sm backdrop-blur-sm"
        >
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reservations</h2>
                <p className="text-sm text-slate-600">Manage today&apos;s bookings for {restaurantName}</p>
              </div>
              <ExportBookingsButton
                restaurantId={restaurantId}
                restaurantName={restaurantName}
                date={summary.date}
              />
            </div>
            <div className="mt-6 space-y-6">
              <BookingsFilterBar value={filter} onChange={setFilter} />
              <BookingsList
                bookings={summary.bookings}
                filter={filter}
                summary={summary}
                onMarkStatus={handleStatusChange}
                pendingBookingId={pendingBookingId}
              />
            </div>
          </div>
        </section>

        {/* VIP Guests always visible with empty state */}
        <section
          aria-label="VIP guests"
          className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-6"
        >
          {showVipModule ? (
            <VIPGuestsModule
              vips={vipData!.vips}
              totalVipCovers={vipData!.totalVipCovers}
              loading={vipsQuery.isLoading}
            />
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">VIP Guests</h3>
              {vipsQuery.isLoading ? null : <span className="text-xs text-slate-500">No VIP arrivals today</span>}
            </div>
          )}
        </section>

        {/* Change feed always visible with empty state */}
        <section
          aria-label="Booking changes"
          className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-6"
        >
          {showChangeFeed ? (
            <BookingChangeFeed
              changes={changeFeedData}
              totalChanges={changeFeedTotal}
              loading={changesQuery.isLoading}
            />
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Recent Changes</h3>
              {changesQuery.isLoading ? null : <span className="text-xs text-slate-500">No changes today</span>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type StatCardConfig = {
  id: string;
  title: string;
  value: number;
  icon: LucideIcon;
  accentBg: string;
  iconColor: string;
};

function StatCard({ config }: { config: StatCardConfig }) {
  const Icon = config.icon;

  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', config.accentBg)}>
          <Icon className={cn('h-5 w-5', config.iconColor)} aria-hidden />
        </div>
      </div>
      <p className="mt-5 text-3xl font-bold text-slate-900">{config.value}</p>
      <p className="text-sm text-slate-600">{config.title}</p>
    </div>
  );
}

type ServicePeriodCardProps = {
  period: PeriodUtilization;
  timezone: string;
};

function ServicePeriodCard({ period, timezone }: ServicePeriodCardProps) {
  const coverLabel =
    period.maxCovers && period.maxCovers > 0 ? `${period.bookedCovers} / ${period.maxCovers}` : `${period.bookedCovers}`;
  const bookingsLabel = `${period.bookedParties} ${period.bookedParties === 1 ? 'booking' : 'bookings'}`;
  const timeLabel = formatTimeRange(period.startTime, period.endTime, timezone);

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm',
        period.isOverbooked && 'border-rose-200 bg-rose-50'
      )}
    >
      <div>
        <p className="text-sm font-semibold text-slate-900">{period.periodName}</p>
        <p className="text-xs text-slate-500">{timeLabel}</p>
      </div>
      <div className="text-right">
        <p className={cn('text-lg font-semibold text-slate-900', period.isOverbooked && 'text-rose-600')}>
          {coverLabel}
        </p>
        <p className="text-xs text-slate-500">{bookingsLabel}</p>
      </div>
    </div>
  );
}

type DateNavigationButtonProps = {
  direction: 'prev' | 'next';
  onClick: () => void;
};

function DateNavigationButton({ direction, onClick }: DateNavigationButtonProps) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  const label = direction === 'prev' ? 'Previous day' : 'Next day';

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      aria-label={label}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

function NoAccessState() {
  return (
    <Card className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 border border-dashed border-border/60 bg-muted/20 p-6 text-center sm:p-10">
      <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
      <p className="text-sm text-muted-foreground">
        Ask an owner or manager to send you an invitation so you can manage bookings.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/ops">Back to dashboard</Link>
      </Button>
    </Card>
  );
}
