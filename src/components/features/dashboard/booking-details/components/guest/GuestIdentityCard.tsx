'use client';

import { Star } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { getGuestInitials } from '../../utils';

import type { OpsTodayBooking } from '@/types/ops';

export type GuestIdentityCardProps = {
  booking: OpsTodayBooking;
};

function getTierGradient(tier: OpsTodayBooking['loyaltyTier']) {
  switch (tier) {
    case 'platinum':
      return 'from-violet-600 to-fuchsia-600';
    case 'gold':
      return 'from-amber-500 to-orange-500';
    case 'silver':
      return 'from-slate-400 to-slate-500';
    case 'bronze':
      return 'from-orange-500 to-amber-600';
    default:
      return 'from-slate-500 to-slate-600';
  }
}

export function GuestIdentityCard({ booking }: GuestIdentityCardProps) {
  const initials = useMemo(() => getGuestInitials(booking.customerName), [booking.customerName]);
  const points = booking.loyaltyPoints;
  const pointsLabel =
    typeof points === 'number' ? `${points.toLocaleString()} points` : 'No loyalty history';

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white text-lg font-bold',
            'bg-gradient-to-br',
            getTierGradient(booking.loyaltyTier ?? null),
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
            {booking.loyaltyTier ? (
              <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wide">
                {booking.loyaltyTier}
              </Badge>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            <span>{pointsLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GuestIdentityCard;

