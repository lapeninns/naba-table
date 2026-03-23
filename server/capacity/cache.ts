import {
  extractCloudflareGatewayError,
  isCloudflareGatewayConfigured,
  requestCloudflareGateway,
} from '@/server/cloudflare/gateway';

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

const POLL_INTERVAL_MS = 10_000; // 10s

const localVersionInventory = new Map<string, number>();
const localVersionAdjacency = new Map<string, number>();

async function bumpVersion(kind: "inv" | "adj", restaurantId: string): Promise<void> {
  if (!isCloudflareGatewayConfigured()) return;
  try {
    const { response, body } = await requestCloudflareGateway<{ version?: number }>(
      '/capacity/versions/bump',
      {
        method: 'POST',
        body: JSON.stringify({ kind, restaurantId }),
      },
    );
    if (!response.ok) {
      throw new Error(
        extractCloudflareGatewayError(
          body,
          `Capacity version bump failed with status ${response.status}`,
        ),
      );
    }
  } catch (error) {
    console.warn('[capacity-cache] failed to bump remote version', {
      restaurantId,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function schedule<T>(fn: () => Promise<T>): void {
  void fn();
}

function getLocalVersionStore(kind: "inv" | "adj") {
  return kind === 'inv' ? localVersionInventory : localVersionAdjacency;
}

function setLocalVersion(kind: "inv" | "adj", restaurantId: string, version: number): void {
  getLocalVersionStore(kind).set(restaurantId, version);
}

async function readRemoteVersions(restaurantIds: string[]): Promise<
  Record<string, { inv: number; adj: number }>
> {
  if (!isCloudflareGatewayConfigured() || restaurantIds.length === 0) {
    return {};
  }

  const uniqueIds = Array.from(new Set(restaurantIds));

  try {
    const { response, body } = await requestCloudflareGateway<{
      versions?: Record<string, { inv?: number; adj?: number }>;
    }>('/capacity/versions/read', {
      method: 'POST',
      body: JSON.stringify({ restaurantIds: uniqueIds }),
    });

    if (!response.ok) {
      throw new Error(
        extractCloudflareGatewayError(
          body,
          `Capacity version read failed with status ${response.status}`,
        ),
      );
    }

    const versions: Record<string, { inv: number; adj: number }> = {};
    for (const restaurantId of uniqueIds) {
      const version = body?.versions?.[restaurantId];
      versions[restaurantId] = {
        inv: typeof version?.inv === 'number' ? version.inv : 0,
        adj: typeof version?.adj === 'number' ? version.adj : 0,
      };
    }

    return versions;
  } catch (error) {
    console.warn('[capacity-cache] failed to read remote versions', {
      restaurantIds: uniqueIds,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
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
}

export function invalidateAdjacencyCache(restaurantId: string): void {
  adjacencyCache.delete(restaurantId);
  const prev = localVersionAdjacency.get(restaurantId) ?? 0;
  localVersionAdjacency.set(restaurantId, prev + 1);
  schedule(() => bumpVersion("adj", restaurantId));
}

// Background poller: if Cloudflare gateway configured, observe remote versions and invalidate local entries when changed
if (isCloudflareGatewayConfigured()) {
  setInterval(async () => {
    try {
      const restaurantIds = Array.from(new Set([...inventoryCache.keys(), ...adjacencyCache.keys()]));
      const versions = await readRemoteVersions(restaurantIds);

      for (const restaurantId of restaurantIds) {
        const remote = versions[restaurantId];
        if (!remote) continue;

        const localInv = localVersionInventory.get(restaurantId) ?? 0;
        if (remote.inv > localInv) {
          inventoryCache.delete(restaurantId);
          setLocalVersion('inv', restaurantId, remote.inv);
        }

        const localAdj = localVersionAdjacency.get(restaurantId) ?? 0;
        if (remote.adj > localAdj) {
          adjacencyCache.delete(restaurantId);
          setLocalVersion('adj', restaurantId, remote.adj);
        }
      }
    } catch {
      // ignore transient errors
    }
  }, POLL_INTERVAL_MS).unref?.();
}

export function isDistributedCacheEnabled(): boolean {
  return isCloudflareGatewayConfigured();
}
