'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/dashboard/Pagination';
import { DASHBOARD_DEFAULT_PAGE_SIZE } from '@/components/dashboard/constants';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';
import { CustomersTable } from './CustomersTable';
import { ExportCustomersButton } from './ExportCustomersButton';

export type OpsRestaurantOption = {
  id: string;
  name: string;
};

type OpsCustomersClientProps = {
  restaurants: OpsRestaurantOption[];
  defaultRestaurantId: string | null;
};

export function OpsCustomersClient({ restaurants, defaultRestaurantId }: OpsCustomersClientProps) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(defaultRestaurantId);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedRestaurantId && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0]?.id ?? null);
    }
  }, [restaurants, selectedRestaurantId]);

  const filters = selectedRestaurantId
    ? {
        restaurantId: selectedRestaurantId,
        page,
        pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
      }
    : null;

  const { data, error, isLoading, isFetching, refetch } = useOpsCustomers(filters);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const handleRestaurantChange = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    setPage(1);
  }, []);

  const pageInfo = data?.pageInfo ?? {
    page,
    pageSize: DASHBOARD_DEFAULT_PAGE_SIZE,
    total: 0,
    hasNext: false,
  };

  const currentRestaurantName =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId)?.name ?? 'Restaurant';

  if (!selectedRestaurantId) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground">No restaurant selected</h2>
        <p className="text-sm text-muted-foreground">Your account doesn't have access to any restaurants yet.</p>
        <Button asChild variant="secondary">
          <Link href="/ops">Back to dashboard</Link>
        </Button>
      </section>
    );
  }

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
          restaurantId={selectedRestaurantId}
          restaurantName={currentRestaurantName}
          disabled={isLoading || !!error}
        />
      </div>

      {restaurants.length > 1 ? (
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="ops-customers-restaurant" className="text-sm font-medium text-foreground">
            Restaurant
          </Label>
          <select
            id="ops-customers-restaurant"
            value={selectedRestaurantId ?? ''}
            onChange={(event) => handleRestaurantChange(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
