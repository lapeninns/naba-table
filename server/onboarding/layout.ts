import 'server-only';

import { z } from 'zod';

import { invalidateRestaurantCapacityCaches } from '@/server/ops/capacity-cache';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export const MAX_ONBOARDING_LAYOUT_ZONES = 25;
export const MAX_ONBOARDING_LAYOUT_TABLES = 50;

export type OnboardingLayoutZoneInput = {
  name: string;
  sortOrder?: number;
  active?: boolean;
};

export type OnboardingLayoutTableInput = {
  tableNumber: string;
  capacity: number;
  minPartySize?: number | null;
  maxPartySize?: number | null;
  /** Name of a zone in the same payload (case-insensitive). Defaults to the first zone. */
  zoneName?: string | null;
  category?: 'dining' | 'bar' | 'lounge' | 'patio' | 'private';
  seatingType?: 'standard' | 'booth' | 'high_top' | 'sofa';
  mobility?: 'fixed' | 'movable';
};

export type OnboardingLayoutInput = {
  zones: OnboardingLayoutZoneInput[];
  tables: OnboardingLayoutTableInput[];
};

export type OnboardingLayoutZone = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type OnboardingLayoutTable = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  zoneId: string;
  category: string;
  seatingType: string;
  mobility: string;
  status: string;
};

export type OnboardingLayout = {
  zones: OnboardingLayoutZone[];
  tables: OnboardingLayoutTable[];
};

/** The restaurant already has bookings or holds, so replacing its layout is refused. */
export class OnboardingLayoutLockedError extends Error {
  constructor() {
    super('ONBOARDING_LAYOUT_LOCKED');
    this.name = 'OnboardingLayoutLockedError';
  }
}

/** The database rejected the payload shape (duplicate names, unknown zone, out of range). */
export class OnboardingLayoutInvalidError extends Error {
  constructor(readonly reason: string) {
    super('ONBOARDING_LAYOUT_INVALID');
    this.name = 'OnboardingLayoutInvalidError';
  }
}

export class OnboardingLayoutRestaurantNotFoundError extends Error {
  constructor() {
    super('ONBOARDING_RESTAURANT_NOT_FOUND');
    this.name = 'OnboardingLayoutRestaurantNotFoundError';
  }
}

/** Unexpected database failure. Carries the Postgres code for logs only, never the message. */
export class OnboardingLayoutWriteError extends Error {
  constructor(readonly dbCode: string | undefined) {
    super('Onboarding layout write failed');
    this.name = 'OnboardingLayoutWriteError';
  }
}

const rpcZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  sort_order: z.number(),
  active: z.boolean(),
});

const rpcTableSchema = z.object({
  id: z.string(),
  table_number: z.string(),
  capacity: z.number(),
  min_party_size: z.number(),
  max_party_size: z.number().nullable(),
  zone_id: z.string(),
  category: z.string(),
  seating_type: z.string(),
  mobility: z.string(),
  status: z.string(),
});

const rpcResultSchema = z.object({
  zones: z.array(rpcZoneSchema),
  tables: z.array(rpcTableSchema),
});

type RpcError = { code?: string; message?: string } | null;

function mapRpcError(error: NonNullable<RpcError>): Error {
  const message = error.message ?? '';
  if (error.code === '55000' && message.startsWith('ONBOARDING_LAYOUT_LOCKED')) {
    return new OnboardingLayoutLockedError();
  }
  if (error.code === '22023' && message.startsWith('ONBOARDING_LAYOUT_INVALID')) {
    const reason = message.slice('ONBOARDING_LAYOUT_INVALID:'.length).trim();
    return new OnboardingLayoutInvalidError(reason);
  }
  if (error.code === 'P0002') {
    return new OnboardingLayoutRestaurantNotFoundError();
  }
  return new OnboardingLayoutWriteError(error.code);
}

/**
 * Replaces the restaurant's zones and tables in one transaction through the
 * `onboarding_replace_layout` RPC. Re-sending the same layout is a no-op, and
 * the call is refused once the restaurant has bookings or table holds.
 */
export async function replaceOnboardingLayout(
  client: DbClient,
  restaurantId: string,
  input: OnboardingLayoutInput,
): Promise<OnboardingLayout> {
  const zones = input.zones.map((zone, index) => ({
    name: zone.name,
    sort_order: zone.sortOrder ?? index,
    active: zone.active ?? true,
  }));
  const tables = input.tables.map((table) => ({
    table_number: table.tableNumber,
    capacity: table.capacity,
    min_party_size: table.minPartySize ?? null,
    max_party_size: table.maxPartySize ?? null,
    zone_name: table.zoneName ?? null,
    category: table.category ?? null,
    seating_type: table.seatingType ?? null,
    mobility: table.mobility ?? null,
  }));

  const { data, error } = await client.rpc('onboarding_replace_layout', {
    p_restaurant_id: restaurantId,
    p_zones: zones,
    p_tables: tables,
  });

  if (error) {
    throw mapRpcError(error);
  }

  const parsed = rpcResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new OnboardingLayoutWriteError('INVALID_RPC_RESULT');
  }

  invalidateRestaurantCapacityCaches(restaurantId);

  return {
    zones: parsed.data.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      sortOrder: zone.sort_order,
      active: zone.active,
    })),
    tables: parsed.data.tables.map((table) => ({
      id: table.id,
      tableNumber: table.table_number,
      capacity: table.capacity,
      minPartySize: table.min_party_size,
      maxPartySize: table.max_party_size,
      zoneId: table.zone_id,
      category: table.category,
      seatingType: table.seating_type,
      mobility: table.mobility,
      status: table.status,
    })),
  };
}
