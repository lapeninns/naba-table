import { Redis } from "@upstash/redis";

import { LruCache } from "./lru-cache";

const DEFAULT_TTL_MS = 30_000; // 30s
const MAX_INV_ENTRIES = Number.parseInt(process.env.CAPACITY_CACHE_MAX_INV ?? "512", 10) || 512;
const MAX_ADJ_ENTRIES = Number.parseInt(process.env.CAPACITY_CACHE_MAX_ADJ ?? "512", 10) || 512;
const SCAVENGE_INTERVAL_MS = Number.parseInt(process.env.CAPACITY_CACHE_SCAVENGE_MS ?? "60000", 10) || 60_000;

type InventoryItem = Record<string, unknown>;

const inventoryCache = new LruCache<InventoryItem[]>(MAX_INV_ENTRIES, DEFAULT_TTL_MS);
const adjacencyCache = new LruCache<Map<string, Set<string>>>(MAX_ADJ_ENTRIES, DEFAULT_TTL_MS);
inventoryCache.startScavenger(SCAVENGE_INTERVAL_MS);
adjacencyCache.startScavenger(SCAVENGE_INTERVAL_MS);

// Optional distributed invalidation (eventual consistency) via Upstash Redis
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis: Redis | null = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const POLL_INTERVAL_MS = 10_000; // 10s
const VERSION_TTL_SECONDS = 60 * 60; // 1 hour

const localVersionInventory = new Map<string, number>();
const localVersionAdjacency = new Map<string, number>();

function versionKey(kind: "inv" | "adj", restaurantId: string): string {
  return `cap:${kind}:ver:${restaurantId}`;
}

async function bumpVersion(kind: "inv" | "adj", restaurantId: string): Promise<void> {
  if (!redis) return;
  try {
    const key = versionKey(kind, restaurantId);
    await redis.incr(key);
    await redis.expire(key, VERSION_TTL_SECONDS);
  } catch {
    // best-effort; ignore
  }
}

function schedule<T>(fn: () => Promise<T>): void {
  void fn();
}

// shim helpers to preserve API
function getWithTtl<T>(store: LruCache<T>, key: string): T | null {
  return store.get(key);
}

function setWithTtl<T>(store: LruCache<T>, key: string, value: T, ttlMs?: number): void {
  store.set(key, value, ttlMs ?? DEFAULT_TTL_MS);
}

export function getInventoryCache(restaurantId: string): InventoryItem[] | null {
  return getWithTtl(inventoryCache, restaurantId);
}

export function setInventoryCache(restaurantId: string, tables: InventoryItem[], ttlMs?: number): void {
  setWithTtl(inventoryCache, restaurantId, tables, ttlMs);
  // Update local version and bump distributed version asynchronously
  const prev = localVersionInventory.get(restaurantId) ?? 0;
  localVersionInventory.set(restaurantId, prev + 1);
  schedule(() => bumpVersion("inv", restaurantId));
}

export function invalidateInventoryCache(restaurantId: string): void {
  inventoryCache.delete(restaurantId);
  const prev = localVersionInventory.get(restaurantId) ?? 0;
  localVersionInventory.set(restaurantId, prev + 1);
  schedule(() => bumpVersion("inv", restaurantId));
}

export function getAdjacencyCache(restaurantId: string): Map<string, Set<string>> | null {
  return getWithTtl(adjacencyCache, restaurantId);
}

export function setAdjacencyCache(
  restaurantId: string,
  graph: Map<string, Set<string>>,
  ttlMs?: number,
): void {
  setWithTtl(adjacencyCache, restaurantId, graph, ttlMs);
  const prev = localVersionAdjacency.get(restaurantId) ?? 0;
  localVersionAdjacency.set(restaurantId, prev + 1);
  schedule(() => bumpVersion("adj", restaurantId));
}

export function invalidateAdjacencyCache(restaurantId: string): void {
  adjacencyCache.delete(restaurantId);
  const prev = localVersionAdjacency.get(restaurantId) ?? 0;
  localVersionAdjacency.set(restaurantId, prev + 1);
  schedule(() => bumpVersion("adj", restaurantId));
}

// Background poller: if Redis configured, observe version keys and invalidate local entries when changed
if (redis) {
  setInterval(async () => {
    try {
      // Inventory cache versions
      for (const restaurantId of inventoryCache.keys()) {
        const key = versionKey("inv", restaurantId);
        const remote = await redis.get<number>(key);
        if (typeof remote === "number") {
          const local = localVersionInventory.get(restaurantId) ?? 0;
          if (remote > local) {
            inventoryCache.delete(restaurantId);
            localVersionInventory.set(restaurantId, remote);
          }
        }
      }

      // Adjacency cache versions
      for (const restaurantId of adjacencyCache.keys()) {
        const key = versionKey("adj", restaurantId);
        const remote = await redis.get<number>(key);
        if (typeof remote === "number") {
          const local = localVersionAdjacency.get(restaurantId) ?? 0;
          if (remote > local) {
            adjacencyCache.delete(restaurantId);
            localVersionAdjacency.set(restaurantId, remote);
          }
        }
      }
    } catch {
      // ignore transient errors
    }
  }, POLL_INTERVAL_MS).unref?.();
}

export function isDistributedCacheEnabled(): boolean {
  return !!redis;
}
