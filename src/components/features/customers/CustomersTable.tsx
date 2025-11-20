'use client';

import { CalendarClock, Mail, Phone, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';

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

function CustomerCard({ customer }: { customer: OpsCustomer }) {
  const hasContact = Boolean(customer.email || customer.phone);
  const loyaltyBadge = customer.totalBookings > 1 ? 'Returning guest' : 'New guest';

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      data-customer-id={customer.id}
      data-customer-email={(customer.email ?? '').toLowerCase()}
      tabIndex={-1}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">{customer.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="border-dashed">
                {loyaltyBadge}
              </Badge>
              {customer.marketingOptIn ? (
                <Badge variant="secondary">Marketing opt-in</Badge>
              ) : (
                <Badge variant="outline">No marketing</Badge>
              )}
            </div>
          </div>
          {hasContact ? (
            <CopyButton
              text={customer.email ?? customer.phone ?? ''}
              label="Contact"
              size="icon"
              variant="outline"
              showToast
              className="h-8 w-8"
            />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" aria-hidden />
              <span className="truncate" title={customer.email ?? undefined}>{customer.email ?? 'No email'}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" aria-hidden />
              <span className="truncate" title={customer.phone ?? undefined}>{customer.phone ?? 'No phone'}</span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <div className="flex items-center justify-end gap-2">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-xs text-muted-foreground">Bookings</span>
              <span className="font-semibold text-foreground">{customer.totalBookings}</span>
            </div>
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Covers</span>
              <span className="text-foreground">{customer.totalCovers}</span>
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" aria-hidden />
              <div>
                <p className="text-[11px] uppercase tracking-wide">Last visit</p>
                <p className="text-sm text-foreground">{formatDateWithRelative(customer.lastBookingAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide">First visit</p>
              <p className="text-sm text-foreground">{formatDateWithRelative(customer.firstBookingAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
          <div className="space-y-3">
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
          <div className="space-y-3">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="min-w-full divide-y divide-border" role="grid">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Customer
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Contact
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Bookings & Covers
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Visits
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Marketing & Loyalty
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {showSkeleton
                ? skeletonRows.map((row) => (
                  <tr key={`skeleton-${row}`}>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-56" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Skeleton className="mx-auto h-5 w-24" />
                    </td>
                  </tr>
                ))
                : customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-muted/50"
                    data-customer-id={customer.id}
                    data-customer-email={(customer.email ?? '').toLowerCase()}
                    tabIndex={-1}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-foreground">{customer.name}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="border-dashed">
                            {customer.totalBookings > 1 ? 'Returning guest' : 'New guest'}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" aria-hidden />
                          <span className="truncate" title={customer.email ?? undefined}>{customer.email ?? 'No email'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" aria-hidden />
                          <span className="truncate" title={customer.phone ?? undefined}>{customer.phone ?? 'No phone'}</span>
                        </div>
                        {customer.email || customer.phone ? (
                          <div className="flex items-center gap-2">
                            <CopyButton
                              text={customer.email ?? customer.phone ?? ''}
                              label="Contact"
                              size="icon"
                              variant="ghost"
                              showToast
                              className="h-8 w-8"
                            />
                            <span className="text-xs text-muted-foreground">Copy contact</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-foreground">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Bookings</span>
                          <span className="font-semibold">{customer.totalBookings}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>Covers</span>
                          <span className="text-foreground">{customer.totalCovers}</span>
                        </div>
                        {customer.totalCancellations > 0 ? (
                          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>Cancellations</span>
                            <span className="text-foreground">{customer.totalCancellations}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted-foreground">
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">Last visit</p>
                          <p className="text-foreground">{formatDateWithRelative(customer.lastBookingAt)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide">First visit</p>
                          <p className="text-foreground">{formatDateWithRelative(customer.firstBookingAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col items-start gap-2">
                        <Badge variant={customer.marketingOptIn ? 'secondary' : 'outline'} className="text-xs">
                          {customer.marketingOptIn ? 'Opted in' : 'Opted out'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {customer.totalBookings > 1 ? 'Returning' : 'New'}
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {showEmpty && <EmptyState hasActiveFilters={hasActiveFilters} />}
      </div>
    </div>
  );
}
