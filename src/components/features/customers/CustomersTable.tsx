'use client';

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import type { OpsCustomer } from '@/types/ops';

type CustomersTableProps = {
  customers: OpsCustomer[];
  isLoading: boolean;
};

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function EmptyState() {
  return (
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-foreground">No customers yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Customers who make bookings will appear here. Their booking history and preferences will be tracked automatically.
        </p>
      </div>
    </div>
  );
}

function CustomerCard({ customer }: { customer: OpsCustomer }) {
  const bookingHref = `/bookings/new?prefillName=${encodeURIComponent(customer.name ?? '')}&prefillEmail=${encodeURIComponent(customer.email ?? '')}&prefillPhone=${encodeURIComponent(customer.phone ?? '')}`;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      data-customer-id={customer.id}
      data-customer-email={(customer.email ?? '').toLowerCase()}
      tabIndex={-1}
    >
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-foreground">{customer.name}</h3>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
          <p className="text-sm text-muted-foreground">{customer.phone}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Bookings:</span>
            <span className="ml-1 font-medium text-foreground">{customer.totalBookings}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Covers:</span>
            <span className="ml-1 font-medium text-foreground">{customer.totalCovers}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Last Visit:</span>
            <span className="ml-1 font-medium text-foreground">{formatDate(customer.lastBookingAt)}</span>
          </div>
        </div>

        {customer.marketingOptIn && (
          <Badge variant="secondary" className="text-xs">
            Marketing Opt-in
          </Badge>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="touch-manipulation">
            <Link href={bookingHref}>New booking</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CustomersTable({ customers, isLoading }: CustomersTableProps) {
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
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="mb-1 h-4 w-48" />
                <Skeleton className="mb-3 h-4 w-40" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <EmptyState />
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
                  Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Phone
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Bookings
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Covers
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Last Visit
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Marketing
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {showSkeleton
                ? skeletonRows.map((row) => (
                  <tr key={`skeleton-${row}`}>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Skeleton className="mx-auto h-5 w-16" />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Skeleton className="mx-auto h-9 w-24" />
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
                    <td className="px-4 py-4 font-medium text-foreground">{customer.name}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{customer.email}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{customer.phone}</td>
                    <td className="px-4 py-4 text-right text-sm text-foreground">{customer.totalBookings}</td>
                    <td className="px-4 py-4 text-right text-sm text-foreground">{customer.totalCovers}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatDate(customer.lastBookingAt)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {customer.marketingOptIn ? (
                        <Badge variant="secondary" className="text-xs">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button asChild variant="outline" size="sm" className="touch-manipulation">
                        <Link
                          href={`/bookings/new?prefillName=${encodeURIComponent(customer.name ?? '')}&prefillEmail=${encodeURIComponent(customer.email ?? '')}&prefillPhone=${encodeURIComponent(customer.phone ?? '')}`}
                        >
                          New booking
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {showEmpty && <EmptyState />}
      </div>
    </div>
  );
}
