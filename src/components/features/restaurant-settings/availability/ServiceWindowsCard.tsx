'use client';

import { AlertCircle, RotateCcw, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

import { AvailabilityScheduleErrorState } from './AvailabilityScheduleStates';
import { AvailabilityScheduleDayCard } from './ScheduleDayCard';
import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';
import { useServiceWindowsCardState } from './useServiceWindowsCardState';

type ServiceWindowsCardProps = {
  restaurantId: string | null;
};

export function ServiceWindowsCard({ restaurantId }: ServiceWindowsCardProps) {
  const state = useServiceWindowsCardState({ restaurantId });

  if (!restaurantId) {
    return null;
  }

  if (state.isLoading) {
    return (
      <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')}>
        <CardHeader className={cn(SETTINGS_COMPACT_CARD_HEADER_CLASS, 'pb-3')}>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (state.loadError) {
    return <AvailabilityScheduleErrorState message={state.loadError.message} />;
  }

  return (
    <Card
      className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')}
      id={AVAILABILITY_ANCHORS.serviceWindows}
    >
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            Weekly schedule
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">Meal windows (Lunch / Dinner)</CardTitle>
            <CardDescription className="max-w-3xl">
              Configure independent Lunch and Dinner reservation sessions inside open boundaries.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.isDirty ? (
            <Badge variant="metric" className="h-8 px-3">
              Unsaved changes in this section
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
        {!state.hasRequiredOccasions ? (
          <Alert variant="warning">
            <AlertCircle className="size-4" />
            <AlertTitle>Lunch and dinner booking types are required</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>
                  To manage meal reservation windows, you must first initialize Lunch and Dinner
                  occasions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void state.createRequiredOccasions()}
                  disabled={state.isCreatingOccasions}
                >
                  Create missing lunch and dinner booking types
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {state.dayRows.map(({ day, row, serviceDriftFields }) => {
          return (
            <AvailabilityScheduleDayCard
              key={day.dayOfWeek}
              day={day}
              dayError={state.serviceErrors[day.dayOfWeek]}
              hasRequiredOccasions={state.hasRequiredOccasions}
              onMealTimeChange={state.handleMealTimeChange}
              onMealToggle={state.handleMealToggle}
              onWeeklyChange={() => {}}
              row={row}
              rowErrors={undefined}
              weeklyDriftField={null}
              serviceDriftFields={serviceDriftFields}
              showWeeklyHours={false}
            />
          );
        })}
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('service-windows')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={state.handleReset}
            disabled={state.updateServicePeriods.isPending || !state.isDirty}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button
            type="button"
            onClick={state.handleSave}
            disabled={!state.isDirty || state.updateServicePeriods.isPending}
          >
            <Save data-icon="inline-start" aria-hidden />
            Save windows
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
