'use client';

import { Mail, Phone } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CopyButton } from '@src/components/ui/copy-button';

import type { OpsGuestRowViewModel } from './opsCustomersTypes';

type OpsGuestCardProps = {
  guest: OpsGuestRowViewModel;
};

export function OpsGuestCard({ guest }: OpsGuestCardProps) {
  const guestHeadingId = `guest-card-${guest.id}`;

  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border-l-[4px] p-3 shadow-sm',
        'border-border/60 bg-card/60 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-card hover:shadow-md motion-reduce:transition-none',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        guest.railClass,
      )}
      data-customer-id={guest.id}
      data-customer-email={guest.emailSearchValue}
      role="article"
      aria-labelledby={guestHeadingId}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="mt-0.5 h-9 w-9">
            <AvatarFallback className="text-xs font-semibold text-foreground/80">
              {guest.initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={guestHeadingId}
                className="truncate text-sm font-semibold leading-tight text-foreground"
                title={guest.name}
              >
                {guest.name}
              </h3>
              {guest.isVip ? (
                <Badge
                  variant="secondary"
                  className="border border-primary/20 bg-primary/10 text-primary"
                >
                  VIP
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className={cn(
                  'border-dashed',
                  guest.visitStatusLabel === 'Never visited' ? 'text-amber-700' : undefined,
                )}
              >
                {guest.visitStatusLabel}
              </Badge>
              <Badge variant={guest.marketingBadgeVariant} className="whitespace-nowrap">
                {guest.marketingLabel}
              </Badge>
            </div>

            {guest.email || guest.phone ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {guest.email ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate" title={guest.email}>
                      {guest.email}
                    </span>
                  </span>
                ) : null}
                {guest.phone ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate" title={guest.phone}>
                      {guest.phone}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {guest.primaryContact ? (
            <CopyButton
              text={guest.primaryContact}
              label="contact"
              size="icon"
              variant="outline"
              showToast
              className="h-9 w-9"
            />
          ) : null}

          {guest.emailHref ? (
            <Button asChild type="button" size="icon" variant="outline" className="h-9 w-9">
              <a href={guest.emailHref} aria-label={guest.emailLabel} title="Email">
                <Mail className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}

          {guest.telHref ? (
            <Button
              asChild
              type="button"
              size="icon"
              variant="outline"
              className="hidden h-9 w-9 sm:inline-flex"
            >
              <a href={guest.telHref} aria-label={guest.callLabel} title="Call">
                <Phone className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Last visit
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {guest.lastVisitLabel}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bookings
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {guest.totalBookings}
          </p>
        </div>

        <div className="hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Covers
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {guest.totalCovers}
          </p>
        </div>

        <div className="hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cancellations
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {guest.totalCancellations}
          </p>
        </div>
      </div>
    </Card>
  );
}
