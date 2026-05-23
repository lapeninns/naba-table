import Link from 'next/link';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function OpsBookingsPageHeader({
  appliedDate,
  currentRestaurantName,
  opsBasePath,
  restaurantTimezone,
}: {
  appliedDate: string | null;
  currentRestaurantName: string;
  opsBasePath: string;
  restaurantTimezone: string | null;
}) {
  return (
    <OpsPageHeader
      title="Manage bookings"
      meta={
        <>
          <Badge variant="secondary" className="rounded-md font-medium">
            {currentRestaurantName}
          </Badge>
          {appliedDate ? (
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground/40">•</span>
              <span>
                {appliedDate}
                {restaurantTimezone ? ` (${restaurantTimezone})` : ''}
              </span>
            </span>
          ) : null}
        </>
      }
      secondaryActions={
        <Button asChild size="sm" variant="outline" className="h-11 sm:h-9">
          <Link href={`${opsBasePath}/dashboard`}>Back to dashboard</Link>
        </Button>
      }
      primaryAction={
        <Button asChild size="sm" className="h-11 sm:h-9">
          <Link href={`${opsBasePath}/new-bookings`}>New booking</Link>
        </Button>
      }
    />
  );
}
