import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useCustomerService } from "@/contexts/ops-services";
import { queryKeys } from "@/lib/query/keys";

import type { CustomerListParams } from "@/services/ops/customers";
import type { OpsCustomersPage } from "@/types/ops";

export type CustomerFilters = CustomerListParams;

export function useOpsCustomers(filters: CustomerFilters | null) {
  const customerService = useCustomerService();

  const normalizedFilters = useMemo(() => {
    if (!filters) {
      return null;
    }

    const params: CustomerListParams = {
      restaurantId: filters.restaurantId,
      page: filters.page ?? 1,
      pageSize: filters.pageSize,
      sort: filters.sort ?? "desc",
      sortBy: filters.sortBy ?? "last_visit",
      marketingOptIn: filters.marketingOptIn ?? "all",
      lastVisit: filters.lastVisit ?? "any",
      minBookings: filters.minBookings ?? 0,
    };
    const trimmedSearch = filters.search?.trim();
    if (trimmedSearch) params.search = trimmedSearch;

    return params;
  }, [filters]);

  const queryKey = normalizedFilters
    ? queryKeys.opsCustomers.list(normalizedFilters)
    : queryKeys.opsCustomers.list();

  return useQuery<OpsCustomersPage>({
    queryKey,
    queryFn: () => {
      if (!normalizedFilters) {
        throw new Error("Restaurant is required to fetch customers");
      }
      return customerService.list(normalizedFilters);
    },
    enabled: Boolean(normalizedFilters?.restaurantId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
