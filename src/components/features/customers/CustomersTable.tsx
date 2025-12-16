'use client';

import { Mail, Phone } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { OpsCustomer } from '@/types/ops';

type CustomersTableProps = {
  customers: OpsCustomer[];
  isLoading: boolean;
  hasActiveFilters?: boolean;
};

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

function formatDateWithRelative(isoString: string | null): string {
  if (!isoString) return 'No visits yet';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'No visits yet';

  const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const relative = Math.abs(diffDays) <= 365 ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(diffDays, 'day') : null;
  return relative ? `${formatter.format(date)} · ${relative}` : formatter.format(date);
}

function EmptyState({ hasActiveFilters }: { hasActiveFilters?: boolean }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-foreground">{hasActiveFilters ? 'No customers match these filters' : 'No customers yet'}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveFilters
            ? 'Try widening the date window or clearing filters to see more guests.'
            : 'Customers who make bookings will appear here. Their booking history and preferences will be tracked automatically.'}
        </p>
      </div>
    </div>
  );
}

function formatTimeAgo(isoString: string | null): string {
  if (!isoString) return 'No visits yet';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'No visits yet';

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const relative = Math.abs(diffDays) <= 365 ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(diffDays, 'day') : null;
  return relative ?? formatDateWithRelative(isoString);
}

function CustomerCard({ customer }: { customer: OpsCustomer }) {
  const isReturning = customer.totalBookings > 1;
  const hasEmail = Boolean(customer.email);

  const cardBgClass = useMemo(() => {
    if (customer.totalBookings >= 5) return 'border-primary/20 bg-primary/5 hover:bg-primary/10';
    return 'border-border/60 bg-card/60 hover:bg-card hover:shadow-md';
  }, [customer.totalBookings]);

  const primaryContact = customer.email ?? customer.phone ?? null;

  return (
    <Card
      className={cn(
        'group relative flex flex-col gap-2.5 rounded-xl p-3 transition-all',
        'shadow-sm hover:shadow-md',
        cardBgClass,
      )}
      data-customer-id={customer.id}
      data-customer-email={(customer.email ?? '').toLowerCase()}
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight text-foreground" title={customer.name}>
            {customer.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-dashed">
              {isReturning ? 'Returning' : 'New'}
            </Badge>
            {customer.totalBookings >= 5 ? (
              <Badge variant="secondary" className="border border-primary/20 bg-primary/10 text-primary">
                VIP
              </Badge>
            ) : null}
            <Badge variant={customer.marketingOptIn ? 'secondary' : 'outline'} className="whitespace-nowrap">
              {customer.marketingOptIn ? 'Opted in' : 'Opted out'}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {primaryContact ? (
            <CopyButton
              text={primaryContact}
              label="Contact"
              size="icon"
              variant="outline"
              showToast
              className="h-9 w-9"
            />
          ) : null}
          {hasEmail ? (
            <Button asChild type="button" size="sm" variant="outline" className="h-9 px-3">
              <a href={`mailto:${customer.email}`}>Email</a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last visit</p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{formatTimeAgo(customer.lastBookingAt)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bookings</p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{customer.totalBookings}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1 text-[13px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4" aria-hidden />
          <span className="truncate" title={customer.email ?? undefined}>{customer.email ?? 'No email'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" aria-hidden />
          <span className="truncate" title={customer.phone ?? undefined}>{customer.phone ?? 'No phone'}</span>
        </div>
      </div>
    </Card>
  );
}

function DesktopCustomerCard({ customer }: { customer: OpsCustomer }) {
  const isReturning = customer.totalBookings > 1;
  const hasEmail = Boolean(customer.email);
  const primaryContact = customer.email ?? customer.phone ?? null;

  const cardBgClass = useMemo(() => {
    if (customer.totalBookings >= 5) return 'border-primary/20 bg-primary/5 hover:bg-primary/10';
    return 'border-border/60 bg-card/60 hover:bg-card hover:shadow-md';
  }, [customer.totalBookings]);

  return (
    <Card
      className={cn(
        'group relative grid grid-cols-[1fr_220px] items-start gap-3 rounded-xl p-3 transition-all',
        'shadow-sm hover:shadow-md',
        cardBgClass,
      )}
      data-customer-id={customer.id}
      data-customer-email={(customer.email ?? '').toLowerCase()}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground" title={customer.name}>
              {customer.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-dashed">
                {isReturning ? 'Returning' : 'New'}
              </Badge>
              {customer.totalBookings >= 5 ? (
                <Badge variant="secondary" className="border border-primary/20 bg-primary/10 text-primary">
                  VIP
                </Badge>
              ) : null}
              <Badge variant={customer.marketingOptIn ? 'secondary' : 'outline'} className="whitespace-nowrap">
                {customer.marketingOptIn ? 'Opted in' : 'Opted out'}
              </Badge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {primaryContact ? (
              <CopyButton
                text={primaryContact}
                label="Contact"
                size="icon"
                variant="outline"
                showToast
                className="h-9 w-9"
              />
            ) : null}
            {hasEmail ? (
              <Button asChild type="button" size="sm" variant="outline" className="h-9 px-3">
                <a href={`mailto:${customer.email}`}>Email</a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last visit</p>
            <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{formatTimeAgo(customer.lastBookingAt)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bookings</p>
            <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{customer.totalBookings}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Mail className="h-4 w-4" aria-hidden />
          <span className="truncate" title={customer.email ?? undefined}>{customer.email ?? 'No email'}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
          <Phone className="h-4 w-4" aria-hidden />
          <span className="truncate" title={customer.phone ?? undefined}>{customer.phone ?? 'No phone'}</span>
        </div>
      </div>
    </Card>
  );
}

export function CustomersTable({ customers, isLoading, hasActiveFilters }: CustomersTableProps) {
  const showSkeleton = isLoading;
  const showEmpty = !isLoading && customers.length === 0;

  return (
    <div className="space-y-4">
      {/* Mobile view */}
      <div className="md:hidden">
        {showSkeleton ? (
          <div className="grid grid-cols-1 gap-3">
            {skeletonRows.map((row) => (
              <div key={`skeleton-mobile-${row}`} className="rounded-lg border border-border bg-card p-4">
                <Skeleton className="mb-3 h-5 w-40" />
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="mb-2 h-4 w-40" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="col-span-2 h-4 w-36" />
                </div>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState hasActiveFilters={hasActiveFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        {showSkeleton ? (
          <div className="grid grid-cols-1 gap-3">
            {skeletonRows.map((row) => (
              <Card key={`skeleton-desktop-${row}`} className="border-border/60 bg-card/40 p-4">
                <div className="flex items-center gap-4">
                  <div className="min-w-[140px] space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState hasActiveFilters={hasActiveFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {customers.map((customer) => (
              <div key={customer.id} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <DesktopCustomerCard customer={customer} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
