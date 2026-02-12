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
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-lg font-bold',
            'bg-gradient-to-br',
            'from-slate-500 to-slate-700',
          )}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold text-foreground">
              {booking.customerName}
            </h3>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GuestIdentityCard;
