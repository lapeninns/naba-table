'use client';

import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, TrendingUp, UserRound, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { BookingOfflineBanner } from '@/components/features/booking-state-machine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useOpsActiveMembership, useOpsAccountSnapshot } from '@/contexts/ops-session';
import { useOpsTodaySummary, useOpsBookingLifecycleActions, useOpsTodayVIPs, useOpsBookingChanges, useOpsBookingHeatmap } from '@/hooks';
import { useOpsTableAssignmentActions } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDateKey, getTodayInTimezone } from '@/lib/utils/datetime';
import { sanitizeDateParam, computeCalendarRange } from '@/utils/ops/dashboard';

import { BookingChangeFeed } from './BookingChangeFeed';
import { BookingsFilterBar } from './BookingsFilterBar';
import { BookingsList } from './BookingsList';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSkeleton } from './DashboardSkeleton';
import { ExportBookingsButton } from './ExportBookingsButton';
import { HeatmapCalendar } from './HeatmapCalendar';
import { VIPGuestsModule } from './VIPGuestsModule';


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
  const [pendingBookingAction, setPendingBookingAction] = useState<{ bookingId: string; action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' } | null>(null);
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

  const bookingLifecycleMutations = useOpsBookingLifecycleActions();
  const assignmentDate = summary?.date ?? selectedDate ?? null;
  const tableAssignmentActions = useOpsTableAssignmentActions({ restaurantId, date: assignmentDate });
  const allowTableAssignments = useMemo(() => {
    if (!summary) {
      return true;
    }
    const today = getTodayInTimezone(summary.timezone);
    return summary.date >= today;
  }, [summary]);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (date) {
      params.set('date', date);
    } else {
      params.delete('date');
    }

    startTransition(() => {
      router.replace(`/${params.size > 0 ? `?${params.toString()}` : ''}`);
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
        id: 'covers',
        title: 'Guests',
        value: totals.covers ?? 0,
        icon: UserRound,
        accentBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
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

  // All hooks must be called before any early returns
  const tableActionState = useMemo(() => {
    if (tableAssignmentActions.assignTable.isPending) {
      const variables = tableAssignmentActions.assignTable.variables;
      return {
        type: 'assign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
      };
    }
    if (tableAssignmentActions.unassignTable.isPending) {
      const variables = tableAssignmentActions.unassignTable.variables;
      return {
        type: 'unassign' as const,
        bookingId: variables?.bookingId ?? null,
        tableId: variables?.tableId ?? null,
      };
    }
    return null;
  }, [
    tableAssignmentActions.assignTable.isPending,
    tableAssignmentActions.assignTable.variables,
    tableAssignmentActions.unassignTable.isPending,
    tableAssignmentActions.unassignTable.variables,
  ]);

  // Handler functions (not hooks, but keeping them before early returns for consistency)
  const handleMarkNoShow = async (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'no-show' });
    try {
      await bookingLifecycleMutations.markNoShow.mutateAsync({
        restaurantId,
        bookingId,
        performedAt: options?.performedAt ?? null,
        reason: options?.reason ?? null,
        targetDate: summary?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleUndoNoShow = async (bookingId: string, reason?: string | null) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'undo-no-show' });
    try {
      await bookingLifecycleMutations.undoNoShow.mutateAsync({
        restaurantId,
        bookingId,
        reason: reason ?? null,
        targetDate: summary?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-in' });
    try {
      await bookingLifecycleMutations.checkIn.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: summary?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    if (!restaurantId) return;
    setPendingBookingAction({ bookingId, action: 'check-out' });
    try {
      await bookingLifecycleMutations.checkOut.mutateAsync({
        restaurantId,
        bookingId,
        targetDate: summary?.date,
      });
    } finally {
      setPendingBookingAction(null);
    }
  };

  const handleAssignTable = async (bookingId: string, tableId: string) => {
    const result = await tableAssignmentActions.assignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  };

  const handleUnassignTable = async (bookingId: string, tableId: string) => {
    const result = await tableAssignmentActions.unassignTable.mutateAsync({ bookingId, tableId });
    return result.tableAssignments;
  };

  // Early returns must come after all hooks
  if (!restaurantId) {
    return <NoAccessState />;
  }

  if (summaryQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (summaryQuery.isError || !summary) {
    return <DashboardErrorState onRetry={() => summaryQuery.refetch()} />;
  }

  // Derived values after early returns
  const changeFeedData = changesQuery.data?.changes ?? [];
  const changeFeedTotal = changesQuery.data?.totalChanges ?? 0;
  const showChangeFeed = changeFeedData.length > 0;
  const vipData = vipsQuery.data;
  const showVipModule = Boolean(vipData && vipData.vips.length > 0);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Section */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Operations Dashboard</h1>
            <p className="text-sm text-slate-500">{restaurantName}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white p-1 shadow-sm">
            <DateNavigationButton direction="prev" onClick={() => handleShiftDate(-1)} />
            <div className="flex items-center gap-2 px-2">
              <CalendarIcon className="h-4 w-4 text-slate-500" />
              <HeatmapCalendar
                summary={summary}
                heatmap={heatmapQuery.data}
                selectedDate={summary.date}
                onSelectDate={handleSelectDate}
                isLoading={heatmapQuery.isLoading}
              />
            </div>
            <DateNavigationButton direction="next" onClick={() => handleShiftDate(1)} />
          </div>
        </header>

        <section aria-label="Connection status">
          <BookingOfflineBanner />
        </section>

        {/* Stats Grid */}
        {statCards.length > 0 ? (
          <section aria-label="Key performance indicators">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {statCards.map((card) => (
                <StatCard key={card.id} config={card} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Reservations Column */}
          <div className="lg:col-span-8 xl:col-span-9">
            <section
              aria-label="Reservations"
              className="flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <div className="border-b bg-slate-50/50 px-6 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">Reservations</h2>
                    <p className="text-sm text-slate-500">Manage today&apos;s bookings</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!allowTableAssignments ? (
                      <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                        Past date - Assignments locked
                      </p>
                    ) : null}
                    <ExportBookingsButton
                      restaurantId={restaurantId}
                      restaurantName={restaurantName}
                      date={summary.date}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <BookingsFilterBar value={filter} onChange={setFilter} />
                </div>
              </div>

              <div className="flex-1 p-6">
                <BookingsList
                  bookings={summary.bookings}
                  filter={filter}
                  summary={summary}
                  allowTableAssignments={allowTableAssignments}
                  onMarkNoShow={handleMarkNoShow}
                  onUndoNoShow={handleUndoNoShow}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  pendingLifecycleAction={pendingBookingAction}
                  onAssignTable={handleAssignTable}
                  onUnassignTable={handleUnassignTable}
                  tableActionState={tableActionState}
                />
              </div>
            </section>
          </div>

          {/* Sidebar Column */}
          <aside className="space-y-6 lg:col-span-4 xl:col-span-3">
            {/* VIP Guests */}
            <section
              aria-label="VIP guests"
              className="overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <div className="border-b bg-slate-50/50 px-4 py-3">
                <h3 className="font-semibold text-slate-900">VIP Guests</h3>
              </div>
              <div className="p-4">
                {showVipModule ? (
                  <VIPGuestsModule
                    vips={vipData!.vips}
                    totalVipCovers={vipData!.totalVipCovers}
                    loading={vipsQuery.isLoading}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-2 rounded-full bg-slate-100 p-3">
                      <UserRound className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No VIP arrivals today</p>
                  </div>
                )}
              </div>
            </section>

            {/* Change Feed */}
            <section
              aria-label="Booking changes"
              className="overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <div className="border-b bg-slate-50/50 px-4 py-3">
                <h3 className="font-semibold text-slate-900">Recent Changes</h3>
              </div>
              <div className="p-4">
                {showChangeFeed ? (
                  <BookingChangeFeed
                    changes={changeFeedData}
                    totalChanges={changeFeedTotal}
                    loading={changesQuery.isLoading}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-2 rounded-full bg-slate-100 p-3">
                      <Clock className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No changes today</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
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
    <div className="group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg transition-colors', config.accentBg)}>
          <Icon className={cn('h-5 w-5', config.iconColor)} aria-hidden />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{config.value}</p>
        <p className="text-sm font-medium text-slate-500">{config.title}</p>
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
      className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 active:bg-slate-200"
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden />
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
        <Link href="/">Back to dashboard</Link>
      </Button>
    </Card>
  );
}
