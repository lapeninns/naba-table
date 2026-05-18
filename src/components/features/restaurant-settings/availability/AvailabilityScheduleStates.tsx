import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
} from '../shared';

type AvailabilityScheduleErrorStateProps = {
  message: string;
};

export function NoRestaurantAvailabilityScheduleState() {
  return (
    <Card className={SETTINGS_COMPACT_CARD_CLASS}>
      <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
        <CardTitle>Weekly schedule</CardTitle>
        <CardDescription>Select a restaurant to manage availability.</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function AvailabilityScheduleErrorState({ message }: AvailabilityScheduleErrorStateProps) {
  return (
    <Card className={SETTINGS_COMPACT_CARD_CLASS}>
      <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
        <CardTitle>Weekly schedule</CardTitle>
        <CardDescription>Unable to load the unified availability editor.</CardDescription>
      </CardHeader>
      <CardContent className={SETTINGS_COMPACT_CARD_CONTENT_CLASS}>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Availability editor unavailable</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function LoadingAvailabilityScheduleState() {
  return (
    <Card className={SETTINGS_COMPACT_CARD_CLASS}>
      <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
        <Badge variant="outline" className="w-fit">
          Weekly schedule
        </Badge>
        <CardTitle className="text-xl">Operating hours and service windows together</CardTitle>
        <CardDescription>Loading the integrated availability editor.</CardDescription>
      </CardHeader>
      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-3')}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-xl" />
        ))}
      </CardContent>
    </Card>
  );
}
