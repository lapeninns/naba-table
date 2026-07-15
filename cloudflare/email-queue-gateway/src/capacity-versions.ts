type CapacityVersionStorage = {
  get: <T = unknown>(keys: string[]) => Promise<Map<string, T>>;
};

function versionValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
}

export async function readCapacityVersions(
  storage: CapacityVersionStorage,
  restaurantIds: readonly string[],
): Promise<Record<string, { inv: number; adj: number }>> {
  const uniqueIds = [...new Set(restaurantIds)];
  const keys = uniqueIds.flatMap((restaurantId) => [`inv:${restaurantId}`, `adj:${restaurantId}`]);
  const stored = keys.length > 0 ? await storage.get(keys) : new Map<string, unknown>();

  return Object.fromEntries(
    uniqueIds.map((restaurantId) => [
      restaurantId,
      {
        inv: versionValue(stored.get(`inv:${restaurantId}`)),
        adj: versionValue(stored.get(`adj:${restaurantId}`)),
      },
    ]),
  );
}
