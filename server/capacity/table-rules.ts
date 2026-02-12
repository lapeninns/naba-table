/**
 * Table Business Rules
 *
 * This module defines business rules derived from physical table properties.
 * These rules apply uniformly across all restaurants and should NOT be stored
 * in the database as configuration.
 *
 * Key Principles:
 * - Movable tables can be combined → no max party size limit
 * - Fixed tables cannot be merged → max party size = capacity
 * - Rules are derived from physical properties (mobility, capacity)
 */

export type TableMobility = "movable" | "fixed";
export type TableCategory = "dining" | "bar" | "outdoor" | "private";

export interface TablePhysicalProperties {
  capacity: number;
  mobility: TableMobility | string | null | undefined;
  category?: TableCategory | string | null;
}

export interface TablePartyRules {
  minPartySize: number;
  maxPartySize: number | null; // null = unlimited
  canBeMerged: boolean;
  requiresAdjacency: boolean; // for merging
}

/**
 * Derive party size rules from physical table properties
 */
export function deriveTableRules(table: TablePhysicalProperties): TablePartyRules {
  const { capacity, mobility } = table;

  // Default min party size based on capacity
  // 1-person tables allow solo diners, 2+ person tables typically need at least 2
  const defaultMinPartySize = capacity === 1 ? 1 : 1;

  // Default to movable if mobility is not set (legacy compatibility).
  // Treat legacy/unknown values (e.g. "adjustable") as movable to avoid accidental merge breakage.
  const mobilityNormalized =
    typeof mobility === "string" ? mobility.trim().toLowerCase() : mobility ?? "movable";
  const effectiveMobility: TableMobility = mobilityNormalized === "fixed" ? "fixed" : "movable";

  if (effectiveMobility === "movable") {
    // Movable tables can be combined with other tables
    return {
      minPartySize: defaultMinPartySize,
      maxPartySize: null, // Unlimited - can be combined
      canBeMerged: true,
      requiresAdjacency: true, // Must be adjacent to merge
    };
  } else {
    // Fixed tables cannot be moved or merged
    return {
      minPartySize: defaultMinPartySize,
      maxPartySize: capacity, // Strict limit = capacity
      canBeMerged: false,
      requiresAdjacency: false, // N/A - can't merge
    };
  }
}

/**
 * Check if a table can accommodate a party size (without merging)
 */
export function canTableAccommodateParty(
  table: TablePhysicalProperties,
  partySize: number,
  options: {
    allowMaxPartySizeViolation?: boolean;
    allowMinPartySizeViolation?: boolean;
  } = {}
): boolean {
  const rules = deriveTableRules(table);

  // Check minimum party size
  if (!options.allowMinPartySizeViolation && partySize < rules.minPartySize) {
    return false;
  }

  // Check maximum party size
  if (
    !options.allowMaxPartySizeViolation &&
    rules.maxPartySize !== null &&
    partySize > rules.maxPartySize
  ) {
    return false;
  }

  // Check capacity
  if (partySize > table.capacity) {
    // Single table can't hold the party
    // But movable tables can be merged with others
    if (!rules.canBeMerged) {
      return false;
    }
  }

  return true;
}

/**
 * Get max party size for a table
 */
export function getTableMaxPartySize(table: TablePhysicalProperties): number | null {
  return deriveTableRules(table).maxPartySize;
}

/**
 * Get min party size for a table
 */
export function getTableMinPartySize(table: TablePhysicalProperties): number {
  return deriveTableRules(table).minPartySize;
}

/**
 * Check if a table can be merged with others
 */
export function canTableBeMerged(table: TablePhysicalProperties): boolean {
  return deriveTableRules(table).canBeMerged;
}
