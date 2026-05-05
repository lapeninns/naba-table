'use client';

import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { getGuestInitials } from '../../utils';

import type { OpsTodayBooking } from '@/types/ops';

export type GuestIdentityCardProps = {
  booking: OpsTodayBooking;
};

export function GuestIdentityCard({ booking }: GuestIdentityCardProps) {
  const initials = useMemo(() => getGuestInitials(booking.customerName), [booking.customerName]);

  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wider',
            'bg-muted text-muted-foreground border border-border/50',
          )}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-foreground">
              {booking.customerName}
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Primary Guest
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GuestIdentityCard;
