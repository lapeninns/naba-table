'use client';

import { RotateCcw, Save } from 'lucide-react';

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
import { BookingTypesWorkspace } from './BookingTypesWorkspace';
import { useBookingTypesCardState } from './useBookingTypesCardState';
import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';

type BookingTypesCardProps = {
  restaurantId: string | null;
};

export function BookingTypesCard({ restaurantId }: BookingTypesCardProps) {
  const state = useBookingTypesCardState({ restaurantId });

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
          <Skeleton className="h-32 w-full" />
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
      id={AVAILABILITY_ANCHORS.bookingOccasions}
    >
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            Booking types
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">Booking types and turn times</CardTitle>
            <CardDescription className="max-w-3xl">
              Configure Lunch, Dinner, and custom reservation sessions with their turn-time duration
              limits.
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
        <BookingTypesWorkspace
          occasionDrafts={state.occasionDrafts}
          onOccasionsChange={state.handleOccasionsChange}
          onTurnBandsChange={state.handleTurnBandsChange}
          turnBandDefaults={state.turnBandDefaults}
          turnBandErrors={state.turnBandErrors}
          turnBandsDraft={state.turnBandsDraft}
        />
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('booking-occasions')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={state.handleReset}
            disabled={state.updateTurnBands.isPending || !state.isDirty}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button
            type="button"
            onClick={state.handleSave}
            disabled={!state.isDirty || state.updateTurnBands.isPending}
          >
            <Save data-icon="inline-start" aria-hidden />
            Save booking types
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
