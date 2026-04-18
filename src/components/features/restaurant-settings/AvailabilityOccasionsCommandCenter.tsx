'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { AvailabilityScheduleManager } from './AvailabilityScheduleManager';

type AvailabilityOccasionsCommandCenterProps = {
  restaurantId: string | null;
};

export function AvailabilityOccasionsCommandCenter({
  restaurantId,
}: AvailabilityOccasionsCommandCenterProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              Canonical workspace
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl">Availability & Occasions</CardTitle>
              <CardDescription className="max-w-3xl">
                Configure the restaurant&apos;s operating week, special-date overrides, meal
                windows, and bookable occasions without bouncing between separate settings pages.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="#availability-schedule">Schedule</a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="#booking-occasions">Occasions</a>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <AvailabilityScheduleManager restaurantId={restaurantId} />
    </div>
  );
}
