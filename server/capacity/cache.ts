type CacheEntry<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 30_000; // 30s

type InventoryItem = Record<string, unknown>;

const inventoryCache = new Map<string, CacheEntry<InventoryItem[]>>();
const adjacencyCache = new Map<string, CacheEntry<Map<string, Set<string>>>>();

function now(): number {
  return Date.now();
}

function getWithTtl<T>(store: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function setWithTtl<T>(store: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs?: number): void {
  const expiresAt = now() + (typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS);
  store.set(key, { value, expiresAt });
}

export function getInventoryCache(restaurantId: string): InventoryItem[] | null {
  return getWithTtl(inventoryCache, restaurantId);
}

export function setInventoryCache(restaurantId: string, tables: InventoryItem[], ttlMs?: number): void {
  setWithTtl(inventoryCache, restaurantId, tables, ttlMs);
}

export function invalidateInventoryCache(restaurantId: string): void {
  inventoryCache.delete(restaurantId);
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
}

