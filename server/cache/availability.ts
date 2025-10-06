import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

const KEY_PREFIX = "availability:snapshot:v1";

type CacheEntry<T> = {
  version: number;
  data: T;
  storedAt: number;
};

export type AvailabilitySnapshotEntry = {
  id: string;
  table_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
};

export type AvailabilitySnapshot = AvailabilitySnapshotEntry[];

export type CacheReadResult<T> =
  | { status: "disabled" }
  | { status: "miss" }
  | { status: "hit"; value: T };

let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) {
    return client;
  }

  const cacheConfig = env.cache;

  if (!cacheConfig.enableAvailabilityCache) {
    client = null;
    return client;
  }

  if (!cacheConfig.upstash.restUrl || !cacheConfig.upstash.restToken) {
    console.warn(
      "[availability-cache] Upstash credentials missing even though ENABLE_AVAILABILITY_CACHE is true; disabling cache.",
    );
    client = null;
    return client;
  }

  client = new Redis({ url: cacheConfig.upstash.restUrl, token: cacheConfig.upstash.restToken });
  return client;
}

function buildKey(restaurantId: string, bookingDate: string): string {
  return `${KEY_PREFIX}:${restaurantId}:${bookingDate}`;
}

export async function readAvailabilitySnapshot(
  restaurantId: string,
  bookingDate: string,
): Promise<CacheReadResult<AvailabilitySnapshot>> {
  const redis = getClient();
  if (!redis) {
    return { status: "disabled" };
  }

  try {
    const raw = await redis.get<CacheEntry<AvailabilitySnapshot>>(buildKey(restaurantId, bookingDate));
    if (!raw) {
      return { status: "miss" };
    }

    if (typeof raw !== "object" || raw === null || raw.version !== 1 || !Array.isArray(raw.data)) {
      return { status: "miss" };
    }

    return { status: "hit", value: raw.data };
  } catch (error) {
    console.error("[availability-cache] failed to read snapshot", {
      restaurantId,
      bookingDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "miss" };
  }
}

export async function writeAvailabilitySnapshot(
  restaurantId: string,
  bookingDate: string,
  snapshot: AvailabilitySnapshot,
  ttlSeconds: number,
): Promise<void> {
  const redis = getClient();
  if (!redis) {
    return;
  }

  const entry: CacheEntry<AvailabilitySnapshot> = {
    version: 1,
    data: snapshot,
    storedAt: Date.now(),
  };

  try {
    await redis.set(buildKey(restaurantId, bookingDate), entry, { ex: ttlSeconds });
  } catch (error) {
    console.error("[availability-cache] failed to write snapshot", {
      restaurantId,
      bookingDate,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function invalidateAvailabilitySnapshot(restaurantId: string, bookingDate: string): Promise<void> {
  const redis = getClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(buildKey(restaurantId, bookingDate));
  } catch (error) {
    console.error("[availability-cache] failed to invalidate snapshot", {
      restaurantId,
      bookingDate,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isAvailabilityCacheEnabled(): boolean {
  return Boolean(getClient());
}
