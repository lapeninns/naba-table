import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
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

  return useInfiniteQuery<OpsCustomersPage>({
    queryKey,
    queryFn: ({ pageParam }) => {
      if (!normalizedFilters) {
        throw new Error("Restaurant is required to fetch customers");
      }
      const page = typeof pageParam === "number" ? pageParam : 1;
      return customerService.list({
        ...normalizedFilters,
        page,
        pageSize: normalizedFilters.pageSize ?? 50,
      });
    },
    enabled: Boolean(normalizedFilters?.restaurantId),
    initialPageParam: 1,
    placeholderData: (previous: InfiniteData<OpsCustomersPage> | undefined) => previous,
    staleTime: 60_000,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNext ? lastPage.pageInfo.page + 1 : undefined,
  });
}
