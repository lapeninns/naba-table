import { invalidateRestaurantCapacityCaches } from "@/server/ops/capacity-cache";

import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


type PublicClient = SupabaseClient<Database>;

export type ZoneRow = Tables<"zones">;

export type CreateZoneInput = {
  restaurantId: string;
  name: string;
  sortOrder?: number | null;
};

export type UpdateZoneInput = {
  name?: string;
  sortOrder?: number | null;
};

export async function listZones(client: PublicClient, restaurantId: string): Promise<ZoneRow[]> {
  const { data, error } = await client
    .from("zones")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createZone(client: PublicClient, input: CreateZoneInput): Promise<ZoneRow> {
  const insertPayload: TablesInsert<"zones"> = {
    restaurant_id: input.restaurantId,
    name: input.name,
    sort_order: input.sortOrder ?? 0,
  };

  const { data, error } = await client.from("zones").insert(insertPayload).select("*").single();

  if (error) {
    throw error;
  }

  const record = data as ZoneRow;
  invalidateRestaurantCapacityCaches(record.restaurant_id);
  return record;
}

export async function updateZone(client: PublicClient, zoneId: string, input: UpdateZoneInput): Promise<ZoneRow> {
  const payload: TablesUpdate<"zones"> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.sortOrder !== undefined) {
    payload.sort_order = input.sortOrder ?? 0;
  }

  const { data, error } = await client.from("zones").update(payload).eq("id", zoneId).select("*").single();

  if (error) {
    throw error;
  }

  const record = data as ZoneRow;
  invalidateRestaurantCapacityCaches(record.restaurant_id);
  return record;
}

export async function deleteZone(client: PublicClient, zoneId: string): Promise<void> {
  const { data, error } = await client.from("zones").delete().eq("id", zoneId).select("restaurant_id").single();

  if (error) {
    throw error;
  }

  invalidateRestaurantCapacityCaches(data?.restaurant_id ?? undefined);
}
