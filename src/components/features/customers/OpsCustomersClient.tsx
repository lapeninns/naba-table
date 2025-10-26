'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { Pagination } from '@/components/dashboard/Pagination';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';

import { CustomersTable } from './CustomersTable';
import { ExportCustomersButton } from './ExportCustomersButton';

export type OpsCustomersClientProps = {
  defaultRestaurantId?: string | null;
};

export function OpsCustomersClient({ defaultRestaurantId }: OpsCustomersClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId, accountSnapshot } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (defaultRestaurantId && defaultRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(defaultRestaurantId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRestaurantId]);

  useEffect(() => {
    if (activeRestaurantId) {
      setPage(1);
    }
  }, [activeRestaurantId]);

  const filters = useMemo(() => {
    if (!activeRestaurantId) {
      return null;
    }
    return {
      restaurantId: activeRestaurantId,
      page,
      pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
      sort: 'desc' as const,
    };
  }, [activeRestaurantId, page]);

  const { data, error, isLoading, isFetching, refetch } = useOpsCustomers(filters);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  if (memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant access yet</h2>
        <p className="text-sm text-muted-foreground">Ask an owner or manager to send you an invitation so you can view customer data.</p>
        <Button asChild variant="secondary">
          <Link href="/ops">Back to dashboard</Link>
        </Button>
      </section>
    );
  }

  if (!activeRestaurantId) {
    return (
      <section className="mx-auto flex min-h-[40vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Loading restaurant access…</h2>
        <p className="text-sm text-muted-foreground">We’re preparing your customers. This will only take a moment.</p>
      </section>
    );
  }

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    total: 0,
    hasNext: false,
  };

  const currentRestaurantName =
    activeMembership?.restaurantName ?? accountSnapshot.restaurantName ?? 'Restaurant';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">
            View and export customer booking data for {currentRestaurantName}.
          </p>
        </div>

        <ExportCustomersButton
          restaurantId={activeRestaurantId}
          restaurantName={currentRestaurantName}
          disabled={isLoading || !!error}
        />
      </div>

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Unable to load customers</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <CustomersTable customers={data?.items ?? []} isLoading={isLoading} />

      {pageInfo.total > 0 && (
        <Pagination
          page={pageInfo.page}
          pageSize={pageInfo.pageSize}
          total={pageInfo.total}
          isLoading={isFetching}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
}
