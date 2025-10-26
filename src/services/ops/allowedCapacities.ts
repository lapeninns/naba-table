import { fetchJson } from "@/lib/http/fetchJson";

import type { OpsServiceError } from "@/types/ops";

const OPS_ALLOWED_CAPACITIES_BASE = "/api/ops/allowed-capacities";

export type AllowedCapacitiesResponse = {
  capacities: number[];
};

export async function getAllowedCapacities(restaurantId: string): Promise<AllowedCapacitiesResponse> {
  const url = `${OPS_ALLOWED_CAPACITIES_BASE}?restaurantId=${encodeURIComponent(restaurantId)}`;

  const response = await fetchJson<AllowedCapacitiesResponse>(url, {
    method: "GET",
  });

  return response;
}

export async function updateAllowedCapacities(
  restaurantId: string,
  capacities: number[],
): Promise<AllowedCapacitiesResponse> {
  const payload = { restaurantId, capacities };

  const response = await fetchJson<AllowedCapacitiesResponse>(OPS_ALLOWED_CAPACITIES_BASE, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response;
}

export type AllowedCapacitiesServiceError = OpsServiceError | Error;
