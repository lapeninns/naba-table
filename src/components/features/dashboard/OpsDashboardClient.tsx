'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsAccountSnapshot } from '@/contexts/ops-session';
import { useOpsTodaySummary, useOpsBookingHeatmap, useOpsBookingStatusActions } from '@/hooks';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardSummaryCard } from './DashboardSummaryCard';
import type { BookingFilter } from './BookingsFilterBar';
import { sanitizeDateParam, computeCalendarRange } from '@/utils/ops/dashboard';

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

  const heatmapRange = useMemo(() => (summary ? computeCalendarRange(summary.date) : null), [summary]);

  const heatmapQuery = useOpsBookingHeatmap({
    restaurantId,
    startDate: heatmapRange?.start ?? null,
    endDate: heatmapRange?.end ?? null,
    enabled: Boolean(restaurantId && heatmapRange),
  });

  const heatmapError = useMemo(() => {
    if (!heatmapQuery.isError) return null;
    const error = heatmapQuery.error;
    return error instanceof Error ? error : new Error('Failed to load booking heatmap');
  }, [heatmapQuery.error, heatmapQuery.isError]);

  const bookingStatusMutation = useOpsBookingStatusActions();

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const params = new URLSearchParams(searchParams.toString());
    if (date) {
      params.set('date', date);
    } else {
      params.delete('date');
    }

    startTransition(() => {
      router.replace(`/ops${params.size > 0 ? `?${params.toString()}` : ''}`);
    });
  };

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

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Service snapshot</h2>
        <p className="text-sm text-muted-foreground">
          Stay on top of today’s reservations and spot issues before service begins.
        </p>
      </section>

      <DashboardSummaryCard
        summary={summary}
        restaurantName={restaurantName}
        selectedDate={summary.date}
        onSelectDate={handleSelectDate}
        heatmap={heatmapQuery.data}
        heatmapLoading={heatmapQuery.isLoading}
        heatmapError={heatmapError}
        filter={filter}
        onFilterChange={setFilter}
        onMarkStatus={handleStatusChange}
        pendingBookingId={pendingBookingId}
      />
    </div>
  );
}

function NoAccessState() {
  return (
    <Card className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 border border-dashed border-border/60 bg-muted/20 p-10 text-center">
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
