'use client';

import { Mail, Phone } from 'lucide-react';
import { useMemo } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { OPS_GUEST_RETURNING_MIN_BOOKINGS, OPS_GUEST_VIP_MIN_BOOKINGS } from '@/lib/ops/customers';
import { cn } from '@/lib/utils';

import type { OpsCustomer } from '@/types/ops';

type OpsGuestCardProps = {
  customer: OpsCustomer;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

function getDateFormatter(localeKey: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${localeKey}:${JSON.stringify(options)}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat(undefined, options);
  formatterCache.set(key, formatter);
  return formatter;
}

function getRelativeFormatter(localeKey: string): Intl.RelativeTimeFormat {
  const existing = relativeFormatterCache.get(localeKey);
  if (existing) return existing;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  relativeFormatterCache.set(localeKey, formatter);
  return formatter;
}

function formatLastVisit(value: string | null): { absolute: string; relative: string | null } {
  if (!value) {
    return { absolute: 'Never visited', relative: null };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { absolute: 'Never visited', relative: null };
  }

  const absolute = getDateFormatter('guest-last-visit', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const relative =
    Math.abs(diffDays) <= 365 ? getRelativeFormatter('guest-last-visit-rel').format(diffDays, 'day') : null;

  return { absolute, relative };
}

function toTelHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Keep "+" and digits; remove common separators. This is intentionally conservative.
  const normalized = trimmed.replace(/[()\\s.-]+/g, '');
  if (!normalized) return null;
  return `tel:${normalized}`;
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
  return initials || 'G';
}

export function OpsGuestCard({ customer }: OpsGuestCardProps) {
  const isVip = customer.totalBookings >= OPS_GUEST_VIP_MIN_BOOKINGS;
  const isReturning = customer.totalBookings >= OPS_GUEST_RETURNING_MIN_BOOKINGS;
  const neverVisited = !customer.lastBookingAt;

  const railClass = useMemo(() => {
    if (isVip) return 'border-l-primary';
    if (isReturning) return 'border-l-emerald-500';
    if (neverVisited) return 'border-l-amber-300';
    return 'border-l-border';
  }, [isReturning, isVip, neverVisited]);

  const primaryContact = customer.email || customer.phone || null;
  const telHref = customer.phone ? toTelHref(customer.phone) : null;
  const lastVisit = useMemo(() => formatLastVisit(customer.lastBookingAt), [customer.lastBookingAt]);
  const guestHeadingId = `guest-card-${customer.id}`;
  const visitStatusLabel = neverVisited ? 'Never visited' : isReturning ? 'Returning' : 'New';
  const emailLabel = customer.email ? `Email ${customer.name}` : undefined;
  const callLabel = customer.phone ? `Call ${customer.name}` : undefined;

  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border-l-[4px] p-3 shadow-sm',
        'border-border/60 bg-card/60 transition-[background-color,border-color,box-shadow] duration-200 hover:bg-card hover:shadow-md motion-reduce:transition-none',
        // Deep-link focus (e.g. `?focus=...`) is programmatic, so we intentionally use `:focus`
        // instead of `:focus-visible` to guarantee a visible indicator.
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
        railClass,
      )}
      data-customer-id={customer.id}
      data-customer-email={(customer.email ?? '').toLowerCase()}
      role="article"
      aria-labelledby={guestHeadingId}
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="mt-0.5 h-9 w-9">
            <AvatarFallback className="text-xs font-semibold text-foreground/80">
              {initialsFromName(customer.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                id={guestHeadingId}
                className="truncate text-sm font-semibold leading-tight text-foreground"
                title={customer.name}
              >
                {customer.name}
              </h3>
              {isVip ? (
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
                className={cn('border-dashed', neverVisited ? 'text-amber-700' : undefined)}
              >
                {visitStatusLabel}
              </Badge>
              <Badge
                variant={customer.marketingOptIn ? 'secondary' : 'outline'}
                className="whitespace-nowrap"
              >
                {customer.marketingOptIn ? 'Opted in' : 'Opted out'}
              </Badge>
            </div>

            {customer.email || customer.phone ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {customer.email ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate" title={customer.email}>
                      {customer.email}
                    </span>
                  </span>
                ) : null}
                {customer.phone ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate" title={customer.phone}>
                      {customer.phone}
                    </span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {primaryContact ? (
            <CopyButton
              text={primaryContact}
              label="contact"
              size="icon"
              variant="outline"
              showToast
              className="h-9 w-9"
            />
          ) : null}

          {customer.email ? (
            <Button asChild type="button" size="icon" variant="outline" className="h-9 w-9">
              <a href={`mailto:${customer.email}`} aria-label={emailLabel} title="Email">
                <Mail className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}

          {telHref ? (
            <Button asChild type="button" size="icon" variant="outline" className="hidden h-9 w-9 sm:inline-flex">
              <a href={telHref} aria-label={callLabel} title="Call">
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
            {lastVisit.relative ? `${lastVisit.absolute} · ${lastVisit.relative}` : lastVisit.absolute}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bookings
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {customer.totalBookings}
          </p>
        </div>

        <div className="hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Covers
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {customer.totalCovers}
          </p>
        </div>

        <div className="hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cancellations
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">
            {customer.totalCancellations}
          </p>
        </div>
      </div>
    </Card>
  );
}
