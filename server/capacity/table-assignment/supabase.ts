import { DateTime } from "luxon";

import { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";
import { releaseTableHold } from "@/server/capacity/holds";
import {
  getContextQueryPaddingMinutes,
  isAdjacencyQueryUndirected,
} from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";


import { ManualSelectionInputError, type DbClient, type Table, type BookingWindow } from "./types";
import { toIsoUtc } from "./utils";

import type { TableHold } from "@/server/capacity/holds";
import type { VenuePolicy } from "@/server/capacity/policy";
import type { Tables } from "@/types/supabase";

export type { DbClient } from "./types";

const TABLE_INVENTORY_SELECT =
  "id,table_number,capacity,min_party_size,max_party_size,section,category,seating_type,mobility,zone_id,status,active,position" as const;

export type TableInventoryRow = Tables<"table_inventory">;

export type BookingRow = Tables<"bookings"> & {
  restaurants?: { timezone: string | null } | { timezone: string | null }[];
};

export type ContextBookingRow = {
  id: string;
  party_size: number;
  status: string;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  booking_date: string | null;
  seating_preference?: string | null;
  booking_table_assignments: Array<{ table_id: string | null }> | null;
};

export type TableHoldRow = Tables<"table_holds"> & {
  table_hold_members: Array<{ table_id: string | null }> | null;
};

export type BookingAssignmentRow = {
  table_id: string;
  id: string;
  start_at: string | null;
  end_at: string | null;
  merge_group_id: string | null;
};

export function ensureClient(client?: DbClient): DbClient {
  return client ?? getServiceSupabaseClient();
}

export function applyAbortSignal<T extends { abortSignal?: (signal: AbortSignal) => T }>(
  builder: T,
  signal?: AbortSignal,
): T {
  if (signal && typeof builder.abortSignal === "function") {
    return builder.abortSignal(signal);
  }
  return builder;
}

export function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function normalizeBookingRow(row: BookingRow): BookingRow {
  if (Array.isArray(row.restaurants) && row.restaurants.length > 0) {
    return { ...row, restaurants: row.restaurants[0] ?? null };
  }
  return row;
}

export async function loadBooking(bookingId: string, client: DbClient, signal?: AbortSignal): Promise<BookingRow> {
  const bookingQuery = applyAbortSignal(
    client
      .from("bookings")
      .select(
        [
          "id",
          "restaurant_id",
          "booking_date",
          "start_time",
          "end_time",
          "start_at",
          "end_at",
          "party_size",
          "status",
          "seating_preference",
          "restaurants(timezone)",
        ].join(","),
      )
      .eq("id", bookingId),
    signal,
  );

  const { data, error } = await bookingQuery.maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load booking", "BOOKING_LOOKUP_FAILED", 500);
  }

  if (!data) {
    throw new ManualSelectionInputError("Booking not found", "BOOKING_NOT_FOUND", 404);
  }

  return normalizeBookingRow(data as unknown as BookingRow);
}

type RestaurantInfo = {
  timezone: string | null;
  slug: string | null;
};

async function loadRestaurantInfo(restaurantId: string, client: DbClient, signal?: AbortSignal): Promise<RestaurantInfo> {
  const restaurantQuery = applyAbortSignal(
    client.from("restaurants").select("timezone, slug").eq("id", restaurantId),
    signal,
  );

  const { data, error } = await restaurantQuery.maybeSingle();

  if (error) {
    throw new ManualSelectionInputError(error.message ?? "Failed to load restaurant metadata", "RESTAURANT_LOOKUP_FAILED", 500);
  }

  return {
    timezone: data?.timezone ?? null,
    slug: data?.slug ?? null,
  };
}

export async function loadRestaurantTimezone(
  restaurantId: string,
  client: DbClient,
  signal?: AbortSignal,
): Promise<string | null> {
  const info = await loadRestaurantInfo(restaurantId, client, signal);
  return info.timezone;
}

export async function loadTablesForRestaurant(
  restaurantId: string,
  client: DbClient,
  signal?: AbortSignal,
): Promise<Table[]> {
  try {
    const { getInventoryCache } = await import("@/server/capacity/cache");
    const cached = getInventoryCache(restaurantId);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached as Table[];
    }
  } catch {
    // ignore cache fetch failures
  }

  const query = applyAbortSignal(
    client.from("table_inventory").select(TABLE_INVENTORY_SELECT).eq("restaurant_id", restaurantId),
    signal,
  );
  const { data, error } = await query;

  if (error || !data) {
    throw new ManualSelectionInputError(error?.message ?? "Failed to load table inventory", "TABLE_INVENTORY_LOOKUP_FAILED", 500);
  }

  const rows = data as TableInventoryRow[];
  const tables = rows.map<Table>((row) => ({
    id: row.id,
    tableNumber: row.table_number,
    capacity: row.capacity ?? 0,
    minPartySize: row.min_party_size ?? null,
    maxPartySize: row.max_party_size ?? null,
    section: row.section,
    category: row.category,
    seatingType: row.seating_type,
    mobility: row.mobility,
    zoneId: row.zone_id,
    status: row.status,
    active: row.active,
    position: row.position,
  }));

  try {
    const { setInventoryCache } = await import("@/server/capacity/cache");
    setInventoryCache(restaurantId, tables);
  } catch {
    // ignore cache set failure
  }

  return tables;
}

export async function loadTablesByIds(
  restaurantId: string,
  tableIds: string[],
  client: DbClient,
  signal?: AbortSignal,
): Promise<Table[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(tableIds));
  const tableQuery = applyAbortSignal(
    client
      .from("table_inventory")
      .select<typeof TABLE_INVENTORY_SELECT, TableInventoryRow>(TABLE_INVENTORY_SELECT)
      .eq("restaurant_id", restaurantId)
      .in("id", uniqueIds),
    signal,
  );

  const { data, error } = await tableQuery;

  if (error || !data) {
    return [];
  }

  const rows = data as TableInventoryRow[];

  const lookup = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        tableNumber: row.table_number,
        capacity: row.capacity ?? 0,
        minPartySize: row.min_party_size ?? null,
        maxPartySize: row.max_party_size ?? null,
        section: row.section,
        category: row.category,
        seatingType: row.seating_type,
        mobility: row.mobility,
        zoneId: row.zone_id,
        status: row.status,
        active: row.active,
        position: row.position,
      } satisfies Table,
    ]),
  );

  return tableIds.reduce<Table[]>((acc, id) => {
    const table = lookup.get(id);
    if (table) {
      acc.push(table);
    }
    return acc;
  }, []);
}

export async function loadAdjacency(
  restaurantId: string,
  tableIds: string[],
  client: DbClient,
  signal?: AbortSignal,
): Promise<Map<string, Set<string>>> {
  const uniqueTableIds = Array.from(
    new Set(
      tableIds.filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (uniqueTableIds.length === 0) {
    return new Map();
  }

  let cachedGraph: Map<string, Set<string>> | null = null;
  try {
    const { getAdjacencyCache } = await import("@/server/capacity/cache");
    cachedGraph = getAdjacencyCache(restaurantId);
  } catch {
    cachedGraph = null;
  }
  const missing: string[] = [];
  if (cachedGraph) {
    for (const id of uniqueTableIds) {
      if (!cachedGraph.has(id)) {
        missing.push(id);
      }
    }
  }
  const needFetch = !cachedGraph || missing.length > 0;

  type AdjacencyRow = { table_a: string | null; table_b: string | null };
  const baseQuery = () => applyAbortSignal(client.from("table_adjacencies").select("table_a, table_b"), signal);
  const adjacencyUndirected = isAdjacencyQueryUndirected();
  const targetIds = needFetch && cachedGraph ? missing : uniqueTableIds;
  const forward = await baseQuery().in("table_a", targetIds);
  if (forward.error) {
    return new Map();
  }

  const reverse = adjacencyUndirected ? await baseQuery().in("table_b", targetIds) : null;
  if (reverse?.error) {
    return new Map();
  }

  const forwardRows = Array.isArray(forward.data) ? (forward.data as AdjacencyRow[]) : [];
  const reverseRows =
    adjacencyUndirected && reverse && Array.isArray(reverse.data)
      ? (reverse.data as AdjacencyRow[])
      : [];

  const map = cachedGraph ? new Map<string, Set<string>>(cachedGraph) : new Map<string, Set<string>>();
  if (targetIds.length > 0) {
    for (const id of targetIds) {
      map.delete(id);
    }
  }
  const addEdge = (from: string | null, to: string | null) => {
    if (!from || !to) {
      return;
    }
    if (!map.has(from)) {
      map.set(from, new Set());
    }
    map.get(from)!.add(to);
  };

  for (const row of forwardRows) {
    addEdge(row.table_a, row.table_b);
    if (adjacencyUndirected) {
      addEdge(row.table_b, row.table_a);
    }
  }

  if (adjacencyUndirected && reverseRows) {
    for (const row of reverseRows) {
      addEdge(row.table_a, row.table_b);
      addEdge(row.table_b, row.table_a);
    }
  }

  try {
    const { setAdjacencyCache } = await import("@/server/capacity/cache");
    setAdjacencyCache(restaurantId, map);
  } catch {
    // ignore cache set failures
  }

  const filtered = new Map<string, Set<string>>();
  for (const id of uniqueTableIds) {
    if (map.has(id)) {
      filtered.set(id, new Set(map.get(id)!));
    }
  }
  return filtered;
}

export async function loadContextBookings(
  restaurantId: string,
  bookingDate: string | null,
  client: DbClient,
  aroundWindow?: { startIso: string; endIso: string; paddingMinutes?: number },
  signal?: AbortSignal,
): Promise<ContextBookingRow[]> {
  if (!bookingDate) {
    return [];
  }

  const paddingDefault = Math.max(0, Math.min(getContextQueryPaddingMinutes(), 240));
  const pad = Math.max(0, Math.min(aroundWindow?.paddingMinutes ?? paddingDefault, 240));
  const startIso = aroundWindow?.startIso ?? null;
  const endIso = aroundWindow?.endIso ?? null;
  const padMs = pad * 60 * 1000;
  const startPad = startIso ? DateTime.fromISO(startIso, { setZone: true }).minus({ milliseconds: padMs }).toISO() : null;
  const endPad = endIso ? DateTime.fromISO(endIso, { setZone: true }).plus({ milliseconds: padMs }).toISO() : null;

  let query = client
    .from("bookings")
    .select(
      [
        "id",
        "party_size",
        "status",
        "start_time",
        "end_time",
        "start_at",
        "end_at",
        "booking_date",
        "booking_table_assignments(table_id)",
      ].join(","),
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", bookingDate)
    .in("status", [...BOOKING_BLOCKING_STATUSES])
    .order("start_at", { ascending: true });

  query = applyAbortSignal(query, signal);

  const hasGt = typeof (query as unknown as { gt?: unknown }).gt === "function";
  const hasLt = typeof (query as unknown as { lt?: unknown }).lt === "function";
  if (startPad && hasGt) {
    (query as unknown as { gt: (col: string, val: string) => unknown }).gt("end_at", startPad);
  }
  if (endPad && hasLt) {
    (query as unknown as { lt: (col: string, val: string) => unknown }).lt("start_at", endPad);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as unknown as ContextBookingRow[];
}

export async function loadTableAssignmentsForTables(
  bookingId: string,
  tableIds: string[],
  client: DbClient,
): Promise<BookingAssignmentRow[]> {
  if (tableIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("booking_table_assignments")
    .select("table_id, id, start_at, end_at, merge_group_id")
    .eq("booking_id", bookingId);

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as BookingAssignmentRow[];
  return rows.filter((row) => tableIds.includes(row.table_id));
}

export async function fetchHoldsForWindow(
  restaurantId: string,
  window: BookingWindow,
  client: DbClient,
): Promise<TableHold[]> {
  const { data, error } = await client
    .from("table_holds")
    .select("*, table_hold_members(table_id)")
    .eq("restaurant_id", restaurantId)
    .gt("expires_at", new Date().toISOString())
    .lt("start_at", toIsoUtc(window.block.end))
    .gt("end_at", toIsoUtc(window.block.start));

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  const rows = data as TableHoldRow[];

  return rows.map((row) => {
    const members = row.table_hold_members ?? [];
    const tableIds = members
      .map((member) => member.table_id)
      .filter((value): value is string => typeof value === "string");
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

export async function loadActiveHoldsForDate(
  restaurantId: string,
  bookingDate: string | null,
  policy: VenuePolicy,
  client: DbClient,
  signal?: AbortSignal,
): Promise<TableHold[]> {
  if (!bookingDate) {
    return [];
  }

  const day = DateTime.fromISO(bookingDate, { zone: policy.timezone ?? "UTC" });
  if (!day.isValid) {
    return [];
  }

  const dayStart = toIsoUtc(day.startOf("day"));
  const dayEnd = toIsoUtc(day.plus({ days: 1 }).startOf("day"));
  const now = toIsoUtc(DateTime.now());

  const holdsQuery = applyAbortSignal(
    client
      .from("table_holds")
      .select("*, table_hold_members(table_id)")
      .eq("restaurant_id", restaurantId)
      .gt("expires_at", now)
      .lt("start_at", dayEnd)
      .gt("end_at", dayStart),
    signal,
  );

  const { data, error } = await holdsQuery;

  if (error || !data) {
    throw error ?? new Error("Failed to load holds");
  }

  const rows = data as TableHoldRow[];

  return rows.map((row) => {
    const members = row.table_hold_members ?? [];
    const tableIds = members
      .map((member) => member.table_id)
      .filter((value): value is string => typeof value === "string");
    return {
      id: row.id,
      bookingId: row.booking_id,
      restaurantId: row.restaurant_id,
      zoneId: row.zone_id,
      startAt: row.start_at,
      endAt: row.end_at,
      expiresAt: row.expires_at,
      tableIds,
      createdBy: row.created_by ?? null,
      metadata: row.metadata ?? null,
    } satisfies TableHold;
  });
}

export async function releaseHoldWithRetry(params: {
  holdId: string;
  client: DbClient;
  attempts?: number;
  baseDelayMs?: number;
}): Promise<void> {
  const { holdId, client, attempts = 3, baseDelayMs = 50 } = params;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await releaseTableHold({ holdId, client });
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      const jitter = Math.random() * baseDelayMs;
      const delay = baseDelayMs * attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function findMissingHoldMetadataFields(holdRow: TableHoldRow): string[] {
  const missing: string[] = [];
  const rawMetadata = (holdRow as { metadata?: unknown }).metadata;

  if (!rawMetadata || typeof rawMetadata !== "object") {
    return ["metadata"];
  }

  const metadata = rawMetadata as Record<string, unknown>;
  if (typeof metadata.policyVersion !== "string" || metadata.policyVersion.trim().length === 0) {
    missing.push("metadata.policyVersion");
  }

  const selection = metadata.selection as Record<string, unknown> | undefined;
  if (!selection || typeof selection !== "object") {
    missing.push("metadata.selection");
    return missing;
  }

  const snapshot = selection.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || typeof snapshot !== "object") {
    missing.push("metadata.selection.snapshot");
    return missing;
  }

  const zoneIds = snapshot.zoneIds;
  if (!Array.isArray(zoneIds) || zoneIds.length === 0 || zoneIds.some((zone) => typeof zone !== "string" || zone.trim().length === 0)) {
    missing.push("metadata.selection.snapshot.zoneIds");
  }

  const adjacency = snapshot.adjacency as Record<string, unknown> | undefined;
  if (!adjacency || typeof adjacency !== "object") {
    missing.push("metadata.selection.snapshot.adjacency");
    return missing;
  }

  const edges = adjacency.edges;
  if (!Array.isArray(edges) || edges.some((edge) => typeof edge !== "string")) {
    missing.push("metadata.selection.snapshot.adjacency.edges");
  }

  const hash = adjacency.hash;
  if (typeof hash !== "string" || hash.trim().length === 0) {
    missing.push("metadata.selection.snapshot.adjacency.hash");
  }

  return missing;
}
