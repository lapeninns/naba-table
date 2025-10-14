'use client';

import { AlertTriangle, TrendingUp } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type PeriodUtilization = {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  bookedCovers: number;
  bookedParties: number;
  maxCovers: number | null;
  maxParties: number | null;
  utilizationPercentage: number;
  isOverbooked: boolean;
};

type CapacityVisualizationProps = {
  periods: PeriodUtilization[];
  loading?: boolean;
  hasOverbooking?: boolean;
};

function getUtilizationColor(percentage: number, isOverbooked: boolean): string {
  if (isOverbooked) return 'bg-red-500';
  if (percentage >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getUtilizationTextColor(percentage: number, isOverbooked: boolean): string {
  if (isOverbooked) return 'text-red-600';
  if (percentage >= 80) return 'text-yellow-600';
  return 'text-green-600';
}

export function CapacityVisualization({ periods, loading, hasOverbooking }: CapacityVisualizationProps) {
  if (loading) {
    return <CapacityVisualizationSkeleton />;
  }

  if (periods.length === 0) {
    return (
      <Alert variant="default" className="border-border/60 bg-background">
        <AlertTitle className="text-sm font-medium">No service periods configured</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          Set up service periods and capacity rules in restaurant settings to track utilization.
        </AlertDescription>
      </Alert>
    );
  }

  const overbooked = periods.filter((p) => p.isOverbooked);

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <TrendingUp className="h-5 w-5" aria-hidden />
        Service Capacity
      </h3>

      {hasOverbooking && overbooked.length > 0 ? (
        <Alert variant="destructive" className="rounded-xl border-border/60">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-medium">Service Overbooked</AlertTitle>
          <AlertDescription className="text-xs">
            {overbooked.length === 1
              ? `${overbooked[0]!.periodName} is overbooked.`
              : `${overbooked.length} services are overbooked: ${overbooked.map((p) => p.periodName).join(', ')}.`}{' '}
            Review bookings to avoid service issues.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {periods.map((period) => (
          <PeriodCard key={period.periodId} period={period} />
        ))}
      </div>
    </div>
  );
}

function PeriodCard({ period }: { period: PeriodUtilization }) {
  const hasCapacity = period.maxCovers !== null && period.maxCovers > 0;
  const progressColor = getUtilizationColor(period.utilizationPercentage, period.isOverbooked);
  const textColor = getUtilizationTextColor(period.utilizationPercentage, period.isOverbooked);

  return (
    <div className={cn('rounded-xl border border-border/10 bg-background p-3 shadow-sm', period.isOverbooked && 'border-red-500 border-2')}>
      <div className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">{period.periodName}</h4>
          <p className="text-xs text-muted-foreground">
            {period.startTime} - {period.endTime}
          </p>
        </div>

        {hasCapacity ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Covers</span>
              <span className={cn('text-sm font-semibold', textColor)}>
                {period.bookedCovers} / {period.maxCovers}
              </span>
            </div>

            <Progress
              value={period.bookedCovers}
              max={period.maxCovers ?? undefined}
              className="h-2"
              aria-label={`${period.periodName} capacity at ${period.utilizationPercentage}%`}
            >
              <div className={cn('h-full w-full flex-1 transition-all', progressColor)} />
            </Progress>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {period.bookedParties} {period.bookedParties === 1 ? 'booking' : 'bookings'}
              </span>
              <span className={cn('text-xs font-medium', textColor)}>{period.utilizationPercentage}%</span>
            </div>
          </>
        ) : (
          <div className="py-2">
            <p className="text-xs italic text-muted-foreground">No capacity limit set</p>
            <p className="mt-1 text-sm text-foreground">
              {period.bookedCovers} covers ({period.bookedParties} bookings)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CapacityVisualizationSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/10 bg-background p-3 shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
