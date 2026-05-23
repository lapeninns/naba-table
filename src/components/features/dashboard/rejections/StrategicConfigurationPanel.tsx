'use client';

import { FlaskConical, Settings2 } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_FOOTER_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { formatCount, formatDateTime } from './rejectionDashboardDomain';
import { SettingsMetric } from './RejectionDashboardMetrics';

import type { OpsStrategicSettings } from '@/types/ops';

export function StrategicConfigurationPanel({
  error,
  isLoading,
  isSimulationRunning,
  onEditWeights,
  onRunSimulation,
  restaurantName,
  settings,
}: {
  readonly error: Error | null;
  readonly isLoading: boolean;
  readonly isSimulationRunning: boolean;
  readonly onEditWeights: () => void;
  readonly onRunSimulation: () => void;
  readonly restaurantName: string;
  readonly settings: OpsStrategicSettings | undefined;
}) {
  return (
    <Card className={OPS_CARD_CLASS}>
      <CardHeader
        className={cn(
          OPS_CARD_HEADER_CLASS,
          'flex flex-col gap-2 md:flex-row md:items-center md:justify-between',
        )}
      >
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Settings2 className="size-5" aria-hidden />
            Strategic configuration
          </CardTitle>
          <CardDescription>
            Current weights for {restaurantName}. Adjust to balance occupancy and revenue outcomes.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEditWeights} disabled={isLoading}>
            <Settings2 className="mr-2 size-4" aria-hidden />
            Edit weights
          </Button>
          <Button onClick={onRunSimulation} disabled={isSimulationRunning}>
            <FlaskConical
              className={cn('mr-2 size-4', isSimulationRunning && 'animate-spin')}
              aria-hidden
            />
            {isSimulationRunning ? 'Queuing…' : 'Run simulation'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={OPS_CARD_CONTENT_CLASS}>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="border-border/60">
            <AlertTitle>Unable to load settings</AlertTitle>
            <AlertDescription>{error.message ?? 'Unknown error.'}</AlertDescription>
          </Alert>
        ) : settings ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <SettingsMetric
              label="Scarcity"
              value={formatCount(settings.weights.scarcity)}
              tooltip="Weight applied to scarcity scoring"
            />
            <SettingsMetric
              label="Demand multiplier"
              value={
                settings.weights.demandMultiplier === null
                  ? 'Fallback'
                  : settings.weights.demandMultiplier.toFixed(2)
              }
              tooltip="Override applied to demand multiplier"
            />
            <SettingsMetric
              label="Future conflict penalty"
              value={
                settings.weights.futureConflictPenalty === null
                  ? 'Default'
                  : settings.weights.futureConflictPenalty.toFixed(0)
              }
              tooltip="Penalty applied when seating blocks future bookings"
            />
          </div>
        ) : null}
      </CardContent>
      {settings ? (
        <CardFooter className={cn(OPS_CARD_FOOTER_CLASS, 'text-xs text-muted-foreground')}>
          <span>
            Source: {settings.source === 'db' ? 'Supabase overrides' : 'Code/env defaults'} · Last
            updated {formatDateTime(settings.updatedAt)}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
