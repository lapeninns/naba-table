import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Tables } from "@/types/supabase";
import {
  bandDuration,
  getBufferConfig,
  getVenuePolicy,
  serviceWindowFor,
  type BufferConfig,
  type ServiceKey,
  type VenuePolicy,
} from "./policy";

type DbClient = SupabaseClient<Database, "public", any>;
type TableInventoryRow = Pick<
  Tables<"table_inventory">,
  "id" | "table_number" | "capacity" | "min_party_size" | "max_party_size" | "status"
>;

const EXCLUDED_STATUSES = new Set<Tables<"table_inventory">["status"]>(["out_of_service"]);

export type TableRotationDetail = {
  tableId: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  status: Tables<"table_inventory">["status"];
  effectivePartySize: number;
  diningMinutes: number;
  buffer: BufferConfig;
  blockMinutes: number;
  rotations: number;
  covers: number;
};

export type ServiceCapacitySummary = {
  service: ServiceKey;
  serviceMinutes: number;
  tables: TableRotationDetail[];
  totalRotations: number;
  totalCovers: number;
};

export type CalculateCapacityParams = {
  restaurantId: string;
  services?: ServiceKey[];
  referenceDate?: string;
  timezone?: string | null;
  client?: DbClient;
};

function anchorDate(policy: VenuePolicy, referenceDate?: string): DateTime {
  if (referenceDate) {
    const candidate = DateTime.fromISO(`${referenceDate}T00:00`, { zone: policy.timezone });
    if (candidate.isValid) {
      return candidate;
    }
  }
  return DateTime.now().setZone(policy.timezone).startOf("day");
}

function resolvePartySize(table: TableInventoryRow): number {
  const capacity = Math.max(0, table.capacity ?? 0);
  if (capacity === 0) {
    return 0;
  }

  const maxParty = table.max_party_size ? Math.min(table.max_party_size, capacity) : capacity;
  const minParty = Math.max(1, table.min_party_size ?? 1);
  return Math.max(minParty, maxParty);
}

function computeBlockMinutes(service: ServiceKey, partySize: number, policy: VenuePolicy): {
  diningMinutes: number;
  buffer: BufferConfig;
  blockMinutes: number;
} {
  const diningMinutes = bandDuration(service, partySize, policy);
  const buffer = getBufferConfig(service, policy);
  const blockMinutes = Math.max(0, diningMinutes + (buffer.pre ?? 0) + (buffer.post ?? 0));
  return { diningMinutes, buffer, blockMinutes };
}

function summarizeServiceCapacity(
  service: ServiceKey,
  tables: TableInventoryRow[],
  policy: VenuePolicy,
  referenceDate?: string,
): ServiceCapacitySummary | null {
  const serviceDefinition = policy.services[service];
  if (!serviceDefinition) {
    return null;
  }

  const anchor = anchorDate(policy, referenceDate);
  const window = serviceWindowFor(service, anchor, policy);
  const serviceMinutes = Math.max(
    0,
    Math.floor(window.end.diff(window.start, "minutes").minutes),
  );
  if (serviceMinutes === 0) {
    return {
      service,
      serviceMinutes,
      tables: [],
      totalRotations: 0,
      totalCovers: 0,
    };
  }

  const details: TableRotationDetail[] = [];
  let totalRotations = 0;
  let totalCovers = 0;

  for (const table of tables) {
    if (EXCLUDED_STATUSES.has(table.status) || !table.capacity || table.capacity <= 0) {
      continue;
    }

    const partySize = resolvePartySize(table);
    if (partySize <= 0) {
      continue;
    }

    const { diningMinutes, buffer, blockMinutes } = computeBlockMinutes(service, partySize, policy);
    if (blockMinutes <= 0) {
      continue;
    }

    const rotations = Math.max(0, Math.floor(serviceMinutes / blockMinutes));
    const covers = rotations * table.capacity;

    totalRotations += rotations;
    totalCovers += covers;

    details.push({
      tableId: table.id,
      tableNumber: table.table_number,
      capacity: table.capacity,
      minPartySize: table.min_party_size ?? 1,
      maxPartySize: table.max_party_size,
      status: table.status,
      effectivePartySize: partySize,
      diningMinutes,
      buffer,
      blockMinutes,
      rotations,
      covers,
    });
  }

  return {
    service,
    serviceMinutes,
    tables: details,
    totalRotations,
    totalCovers,
  };
}

async function fetchTableInventory(
  restaurantId: string,
  client: DbClient,
): Promise<TableInventoryRow[]> {
  const { data, error } = await client
    .from("table_inventory")
    .select("id, table_number, capacity, min_party_size, max_party_size, status")
    .eq("restaurant_id", restaurantId);

  if (error) {
    throw error;
  }

  return (data ?? []) as TableInventoryRow[];
}

export async function calculateRestaurantCapacityByService(
  params: CalculateCapacityParams,
): Promise<ServiceCapacitySummary[]> {
  const { restaurantId, services, referenceDate, timezone, client } = params;

  const supabase = client ?? getServiceSupabaseClient();
  const tables = await fetchTableInventory(restaurantId, supabase);

  const policy = getVenuePolicy({ timezone });
  const serviceOrder =
    services && services.length > 0
      ? services
      : policy.serviceOrder.filter((service) => Boolean(policy.services[service]));

  const summaries: ServiceCapacitySummary[] = [];

  for (const service of serviceOrder) {
    const summary = summarizeServiceCapacity(service, tables, policy, referenceDate);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

export function calculateCapacityForTables(
  service: ServiceKey,
  tables: TableInventoryRow[],
  options?: { policy?: VenuePolicy; referenceDate?: string },
): ServiceCapacitySummary | null {
  const policy = options?.policy ?? getVenuePolicy();
  return summarizeServiceCapacity(service, tables, policy, options?.referenceDate);
}
