export const TABLE_CAPACITIES = [2, 4, 6] as const;

export type TableCapacity = (typeof TABLE_CAPACITIES)[number];

export type CopiedVenueSpec = {
  id: 'barley-mow' | 'the-prince';
  label: string;
  nameIncludes: readonly string[];
  fallbackIncludes?: readonly string[];
  counts: Record<TableCapacity, number>;
};

export type RestaurantMatch = {
  id: string;
  name: string | null;
  slug: string | null;
};

export type DesiredTable = {
  tableNumber: string;
  capacity: TableCapacity;
};

export const COPIED_VENUE_TABLE_SPECS: readonly CopiedVenueSpec[] = [
  {
    id: 'barley-mow',
    label: 'Barley Mow',
    nameIncludes: ['barley mow'],
    counts: { 2: 3, 4: 12, 6: 5 },
  },
  {
    id: 'the-prince',
    label: 'The Prince',
    nameIncludes: ['the prince'],
    fallbackIncludes: ['prince'],
    counts: { 2: 5, 4: 11, 6: 3 },
  },
];

export function seatTotal(counts: Record<number, number>): number {
  return Object.entries(counts).reduce(
    (sum, [capacity, count]) => sum + Number(capacity) * count,
    0,
  );
}

export function summarizeByCapacity(tables: Array<{ capacity: number }>): Record<string, number> {
  return tables.reduce<Record<string, number>>((acc, table) => {
    const key = String(table.capacity);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function formatTableNumber(capacity: TableCapacity, index: number): string {
  if (!Number.isInteger(index) || index <= 0) {
    throw new Error(`Table index must be a positive integer, received ${index}.`);
  }
  return `T-${capacity}-${index.toString().padStart(2, '0')}`;
}

export function desiredTables(counts: Record<TableCapacity, number>): DesiredTable[] {
  return TABLE_CAPACITIES.flatMap((capacity) =>
    Array.from({ length: counts[capacity] }, (_, index) => ({
      tableNumber: formatTableNumber(capacity, index + 1),
      capacity,
    })),
  );
}

export function countsMatchDesired(
  current: Record<string, number>,
  desired: Record<TableCapacity, number>,
): boolean {
  const currentKeys = Object.keys(current).filter((key) => (current[key] ?? 0) > 0);
  const extraKeys = currentKeys.filter(
    (key) => !TABLE_CAPACITIES.includes(Number(key) as TableCapacity),
  );
  if (extraKeys.length > 0) {
    return false;
  }

  return TABLE_CAPACITIES.every(
    (capacity) => (current[String(capacity)] ?? 0) === desired[capacity],
  );
}

export function normalizeVenueText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function restaurantHaystack(restaurant: RestaurantMatch): string {
  return `${normalizeVenueText(restaurant.name)} ${normalizeVenueText(restaurant.slug)}`.trim();
}

function filterRestaurants<T extends RestaurantMatch>(
  restaurants: T[],
  needles: readonly string[],
): T[] {
  return restaurants.filter((restaurant) => {
    const haystack = restaurantHaystack(restaurant);
    return needles.every((needle) => haystack.includes(needle));
  });
}

export function resolveRestaurant<T extends RestaurantMatch>(
  restaurants: T[],
  spec: CopiedVenueSpec,
): T {
  const phraseMatches = filterRestaurants(restaurants, spec.nameIncludes);
  if (phraseMatches.length === 1) {
    return phraseMatches[0]!;
  }
  if (phraseMatches.length > 1) {
    const slugs = phraseMatches.map((restaurant) => restaurant.slug ?? restaurant.id).join(', ');
    throw new Error(`Multiple restaurants matched ${spec.label}: ${slugs}`);
  }

  if (spec.fallbackIncludes) {
    const fallbackMatches = filterRestaurants(restaurants, spec.fallbackIncludes);
    if (fallbackMatches.length === 1) {
      return fallbackMatches[0]!;
    }
    if (fallbackMatches.length > 1) {
      const slugs = fallbackMatches
        .map((restaurant) => restaurant.slug ?? restaurant.id)
        .join(', ');
      throw new Error(`Multiple restaurants matched ${spec.label}: ${slugs}`);
    }
  }

  throw new Error(`No restaurant matched ${spec.label}.`);
}
