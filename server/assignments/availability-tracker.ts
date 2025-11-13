import { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";
import { LruCache } from "@/server/capacity/lru-cache";
import { loadTablesForRestaurant } from "@/server/capacity/table-assignment/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { TimeSlot } from "./types";
import type { Table } from "@/server/capacity/table-assignment/types";
import type { Tables } from "@/types/supabase";


export type AvailabilitySnapshot = {
  timestamp: number;
  restaurantId: string;
  timeSlot: TimeSlot;
  availableTables: Table[];
  occupiedTables: string[];
  totalCapacity: number;
  largestPartySize: number;
  zones: Record<string, {
    tableIds: string[];
    capacity: number;
    available: number;
  }>;
};

export type AvailabilitySubscriber = (snapshot: AvailabilitySnapshot) => void;

const DEFAULT_CACHE_TTL_MS = 1_000;
const DEFAULT_CACHE_SIZE = 256;

export class TableAvailabilityTracker {
  private cache = new LruCache<AvailabilitySnapshot>(DEFAULT_CACHE_SIZE, DEFAULT_CACHE_TTL_MS);
  private subscribers = new Map<string, Set<AvailabilitySubscriber>>();

  constructor(private readonly supabase = getServiceSupabaseClient()) {}

  async getSnapshot(
    restaurantId: string,
    timeSlot: TimeSlot,
    options?: { includePending?: boolean },
  ): Promise<AvailabilitySnapshot> {
    const includePending = options?.includePending ?? true;
    const cacheKey = this.buildCacheKey(restaurantId, timeSlot, includePending);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshot = await this.buildSnapshot(restaurantId, timeSlot, includePending);
    this.cache.set(cacheKey, snapshot, DEFAULT_CACHE_TTL_MS);
    this.notify(cacheKey, snapshot);
    return snapshot;
  }

  subscribe(
    restaurantId: string,
    timeSlot: TimeSlot,
    callback: AvailabilitySubscriber,
    options?: { includePending?: boolean },
  ): () => void {
    const key = this.buildCacheKey(restaurantId, timeSlot, options?.includePending ?? true);
    const listeners = this.subscribers.get(key) ?? new Set();
    listeners.add(callback);
    this.subscribers.set(key, listeners);
    return () => {
      const set = this.subscribers.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  invalidate(restaurantId?: string): void {
    if (!restaurantId) {
      this.cache.clear();
      return;
    }
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${restaurantId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private async buildSnapshot(restaurantId: string, timeSlot: TimeSlot, includePending: boolean): Promise<AvailabilitySnapshot> {
    const supabase = this.supabase;
    const tables = await loadTablesForRestaurant(restaurantId, supabase);
    const occupiedTableIds = new Set<string>();

    const blockingStatuses = Array.from(BOOKING_BLOCKING_STATUSES) as Tables<"bookings">["status"][];
    const { data: blockingBookings } = await supabase
      .from("bookings")
      .select("id, start_at, end_at, booking_table_assignments(table_id)")
      .eq("restaurant_id", restaurantId)
      .in("status", blockingStatuses)
      .lt("start_at", timeSlot.end)
      .gt("end_at", timeSlot.start);

    if (Array.isArray(blockingBookings)) {
      for (const booking of blockingBookings as Array<
        Tables<"bookings"> & { booking_table_assignments: Array<{ table_id: string | null }> | null }
      >) {
        const assignments = booking.booking_table_assignments ?? [];
        for (const assignment of assignments) {
          if (assignment?.table_id) {
            occupiedTableIds.add(assignment.table_id);
          }
        }
      }
    }

    if (includePending) {
      const { data: holds } = await supabase
        .from("table_holds")
        .select("id, table_hold_members(table_id)")
        .eq("restaurant_id", restaurantId)
        .gt("expires_at", new Date().toISOString())
        .lt("start_at", timeSlot.end)
        .gt("end_at", timeSlot.start);

      if (Array.isArray(holds)) {
        for (const hold of holds as Array<Tables<"table_holds"> & { table_hold_members: Array<{ table_id: string | null }> | null }>) {
          for (const member of hold.table_hold_members ?? []) {
            if (member?.table_id) {
              occupiedTableIds.add(member.table_id);
            }
          }
        }
      }
    }

    const availableTables = tables.filter((table) => table.active !== false && !occupiedTableIds.has(table.id));
    const totalCapacity = availableTables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
    const largestPartySize = availableTables.reduce((max, table) => Math.max(max, table.capacity ?? 0), 0);

    const zones: AvailabilitySnapshot["zones"] = {};
    for (const table of availableTables) {
      const zone = table.zoneId ?? "unassigned";
      if (!zones[zone]) {
        zones[zone] = { tableIds: [], capacity: 0, available: 0 };
      }
      zones[zone]!.tableIds.push(table.id);
      zones[zone]!.capacity += table.capacity ?? 0;
      zones[zone]!.available += 1;
    }

    return {
      timestamp: Date.now(),
      restaurantId,
      timeSlot,
      availableTables,
      occupiedTables: Array.from(occupiedTableIds),
      totalCapacity,
      largestPartySize,
      zones,
    };
  }

  private buildCacheKey(restaurantId: string, timeSlot: TimeSlot, includePending: boolean): string {
    return `${restaurantId}:${timeSlot.start}:${timeSlot.end}:${includePending ? "pending" : "confirmed"}`;
  }

  private notify(cacheKey: string, snapshot: AvailabilitySnapshot): void {
    const listeners = this.subscribers.get(cacheKey);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("[availability-tracker] subscriber failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
