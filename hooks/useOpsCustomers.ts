import { useQuery } from "@tanstack/react-query";

import type { OpsCustomersResponse } from "@/app/api/ops/customers/schema";
import { fetchJson } from "@/lib/http/fetchJson";
import { queryKeys } from "@/lib/query/keys";

export type CustomerFilters = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
};

async function fetchOpsCustomers(filters: CustomerFilters): Promise<OpsCustomersResponse> {
  const params = new URLSearchParams();
  params.set("restaurantId", filters.restaurantId);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sort) params.set("sort", filters.sort);

  const response = await fetchJson<OpsCustomersResponse>(
    `/api/ops/customers?${params.toString()}`,
  );

  return response;
}

export function useOpsCustomers(filters: CustomerFilters | null) {
  return useQuery({
    queryKey: queryKeys.opsCustomers.list(filters),
    queryFn: () => fetchOpsCustomers(filters!),
    enabled: !!filters?.restaurantId,
  });
}
