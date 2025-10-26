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
    };

    if (filters.page) params.page = filters.page;
    if (filters.pageSize) params.pageSize = filters.pageSize;
    if (filters.sort) params.sort = filters.sort;

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
