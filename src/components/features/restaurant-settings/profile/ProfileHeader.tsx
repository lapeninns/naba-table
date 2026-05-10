'use client';

import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ReadinessRing } from './ReadinessRing';

type ProfileHeaderProps = {
  restaurantName: string;
  logoUrl: string | null;
  bookingSlug: string | null;
  readinessScore: number;
  readinessStageLabel: string;
  completedCount: number;
  totalCount: number;
  googleStatusLabel: string;
  googleStatusDetail: string;
  googleDifferenceCount: number;
  googleHref: string;
  nextActionLabel: string | null;
  nextActionDescription: string;
  onJumpToBooking: () => void;
  onJumpToNextAction: (() => void) | null;
};

function getInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'R';
}

export function ProfileHeader({
  restaurantName,
  logoUrl,
  bookingSlug,
  readinessScore,
  readinessStageLabel,
  completedCount,
  totalCount,
  googleStatusLabel,
  googleStatusDetail,
  googleDifferenceCount,
  googleHref,
  nextActionLabel,
  nextActionDescription,
  onJumpToBooking,
  onJumpToNextAction,
}: ProfileHeaderProps) {
  const hasBookingSlug = typeof bookingSlug === 'string' && bookingSlug.trim().length > 0;

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)_minmax(260px,0.45fr)] xl:items-stretch">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="size-14 rounded-md border border-border/70">
            {logoUrl ? <AvatarImage src={logoUrl} alt={`${restaurantName} logo`} /> : null}
            <AvatarFallback className="rounded-md text-sm font-semibold">
              {getInitials(restaurantName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-normal text-foreground">
                {restaurantName}
              </h2>
              <Badge variant="secondary">{readinessStageLabel}</Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Control the details guests see first and the staff-only alerts that support bookings.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant={hasBookingSlug ? 'secondary' : 'outline'}
                className={cn(!hasBookingSlug && 'border-dashed')}
              >
                {hasBookingSlug ? `/${bookingSlug}` : 'Booking URL missing'}
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={onJumpToBooking}>
                {hasBookingSlug ? 'Review booking URL' : 'Add booking URL'}
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={googleHref}>Compare with Google</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col justify-between gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Next best action</p>
            <p className="mt-1 text-sm text-muted-foreground">{nextActionDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextActionLabel && onJumpToNextAction ? (
              <Button type="button" size="sm" onClick={onJumpToNextAction}>
                {nextActionLabel}
              </Button>
            ) : null}
            <Badge variant={googleDifferenceCount > 0 ? 'outline' : 'secondary'}>
              {googleStatusLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{googleStatusDetail}</p>
        </div>

        <div className="flex h-full items-center gap-4 rounded-md border border-border/60 bg-muted/20 p-3">
          <ReadinessRing
            value={readinessScore}
            completed={completedCount}
            total={totalCount}
            size={84}
            stroke={7}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Profile readiness</p>
            <p className="mt-1 max-w-48 text-xs leading-5 text-muted-foreground">
              Required items make the booking link usable. Optional items improve discovery.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
