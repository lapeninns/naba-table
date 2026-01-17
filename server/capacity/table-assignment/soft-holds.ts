/**
 * Soft-Hold Pattern Implementation
 *
 * Prevents race conditions during table evaluation and hold creation by
 * acquiring temporary "soft-holds" that reserve tables for a short period
 * (default 10 seconds) while validation is in progress.
 *
 * Key characteristics:
 * - Short TTL (10 seconds default)
 * - Session-based ownership
 * - Atomic acquisition with rollback on partial failure
 * - Automatic expiry cleanup
 *
 * @module server/capacity/table-assignment/soft-holds
 */

import { recordObservabilityEvent } from '@/server/observability';

import { ensureClient, type DbClient } from './supabase';

// =============================================================================
// Constants
// =============================================================================

/** Default TTL for soft-holds in seconds */
export const SOFT_HOLD_DEFAULT_TTL_SECONDS = 10;

/** Maximum TTL for soft-holds in seconds */
export const SOFT_HOLD_MAX_TTL_SECONDS = 30;

/** Minimum TTL for soft-holds in seconds */
export const SOFT_HOLD_MIN_TTL_SECONDS = 5;

// =============================================================================
// Types
// =============================================================================

export type SoftHoldAcquisitionResult = {
  /** Unique session token for this soft-hold set */
  sessionToken: string;
  /** Tables successfully acquired */
  acquiredTables: string[];
  /** Tables blocked by other sessions */
  blockedTables: Array<{
    tableId: string;
    blockingSession: string | null;
    blockingExpiresAt: Date | null;
  }>;
  /** When these soft-holds expire */
  expiresAt: Date;
  /** Whether all requested tables were acquired */
  allAcquired: boolean;
};

export type SoftHoldOwnershipResult = {
  tableId: string;
  owned: boolean;
  expiresAt: Date | null;
};

export type AcquireSoftHoldsOptions = {
  /** Table IDs to acquire soft-holds for */
  tableIds: string[];
  /** Time window for the soft-holds */
  window: {
    startAt: string;
    endAt: string;
  };
  /** Restaurant ID for scoping */
  restaurantId: string;
  /** Optional booking ID for context */
  bookingId?: string | null;
  /** TTL in seconds (default: SOFT_HOLD_DEFAULT_TTL_SECONDS) */
  ttlSeconds?: number;
  /** Supabase client */
  client?: DbClient;
};

export type ReleaseSoftHoldsOptions = {
  /** Session token to release */
  sessionToken: string;
  /** Optional: specific tables to release (releases all if omitted) */
  tableIds?: string[];
  /** Supabase client */
  client?: DbClient;
};

export type CheckSoftHoldOwnershipOptions = {
  /** Session token to check */
  sessionToken: string;
  /** Table IDs to check ownership for */
  tableIds: string[];
  /** Time window to check */
  window: {
    startAt: string;
    endAt: string;
  };
  /** Supabase client */
  client?: DbClient;
};

// =============================================================================
// Errors
// =============================================================================

export type SoftHoldConflictDetails = {
  tableId: string;
  blockingSession: string | null;
  blockingExpiresAt: Date | null;
};

/**
 * Error thrown when soft-hold acquisition fails due to conflicts.
 */
export class SoftHoldConflictError extends Error {
  constructor(
    message: string,
    public readonly blockedTables: SoftHoldConflictDetails[],
    public readonly sessionToken: string,
  ) {
    super(message);
    this.name = 'SoftHoldConflictError';
  }
}

/**
 * Error thrown when a soft-hold has expired.
 */
export class SoftHoldExpiredError extends Error {
  constructor(
    message: string,
    public readonly sessionToken: string,
    public readonly expiredTables: string[],
  ) {
    super(message);
    this.name = 'SoftHoldExpiredError';
  }
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Generates a unique session token for soft-hold acquisition.
 */
export function generateSoftHoldSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Formats a time window as a PostgreSQL tstzrange string.
 */
function formatTstzrange(startAt: string, endAt: string): string {
  return `[${startAt},${endAt})`;
}

/**
 * Clamps TTL to valid range.
 */
function clampTtl(ttlSeconds: number): number {
  return Math.max(SOFT_HOLD_MIN_TTL_SECONDS, Math.min(ttlSeconds, SOFT_HOLD_MAX_TTL_SECONDS));
}

/**
 * Acquires soft-holds for a set of tables atomically.
 *
 * If any table is already soft-held by another session, the entire
 * acquisition fails and returns details about the blocking session.
 *
 * @param options - Acquisition options
 * @returns Acquisition result with session token and status
 * @throws SoftHoldConflictError if tables are blocked by another session
 */
export async function acquireSoftHolds(
  options: AcquireSoftHoldsOptions,
): Promise<SoftHoldAcquisitionResult> {
  const {
    tableIds,
    window,
    restaurantId,
    bookingId = null,
    ttlSeconds = SOFT_HOLD_DEFAULT_TTL_SECONDS,
    client,
  } = options;

  if (tableIds.length === 0) {
    throw new Error('acquireSoftHolds requires at least one table ID');
  }

  const supabase = ensureClient(client);
  const sessionToken = generateSoftHoldSessionToken();
  const clampedTtl = clampTtl(ttlSeconds);
  const windowRange = formatTstzrange(window.startAt, window.endAt);

  const startTime = performance.now();

  try {
    const { data, error } = await supabase.rpc('acquire_soft_holds_atomic', {
      p_table_ids: tableIds,
      p_window: windowRange,
      p_session_token: sessionToken,
      p_restaurant_id: restaurantId,
      p_booking_id: bookingId,
      p_ttl_seconds: clampedTtl,
    });

    const durationMs = performance.now() - startTime;

    if (error) {
      recordObservabilityEvent({
        source: 'capacity.soft_holds',
        eventType: 'acquire.error',
        restaurantId,
        bookingId: bookingId ?? undefined,
        context: {
          sessionToken,
          tableCount: tableIds.length,
          error: error.message,
          durationMs,
        },
        severity: 'error',
      });
      throw new Error(`Failed to acquire soft-holds: ${error.message}`);
    }

    const results = (data ?? []) as Array<{
      table_id: string;
      acquired: boolean;
      blocking_session: string | null;
      blocking_expires_at: string | null;
    }>;

    const acquiredTables: string[] = [];
    const blockedTables: SoftHoldAcquisitionResult['blockedTables'] = [];

    for (const row of results) {
      if (row.acquired) {
        acquiredTables.push(row.table_id);
      } else {
        blockedTables.push({
          tableId: row.table_id,
          blockingSession: row.blocking_session,
          blockingExpiresAt: row.blocking_expires_at ? new Date(row.blocking_expires_at) : null,
        });
      }
    }

    const allAcquired = blockedTables.length === 0;
    const expiresAt = new Date(Date.now() + clampedTtl * 1000);

    recordObservabilityEvent({
      source: 'capacity.soft_holds',
      eventType: allAcquired ? 'acquire.success' : 'acquire.blocked',
      restaurantId,
      bookingId: bookingId ?? undefined,
      context: {
        sessionToken,
        tableCount: tableIds.length,
        acquiredCount: acquiredTables.length,
        blockedCount: blockedTables.length,
        ttlSeconds: clampedTtl,
        durationMs,
      },
      severity: allAcquired ? 'info' : 'warning',
    });

    // If not all acquired, throw a conflict error
    if (!allAcquired) {
      throw new SoftHoldConflictError(
        `Failed to acquire soft-holds: ${blockedTables.length} table(s) blocked by other sessions`,
        blockedTables.map((t) => ({
          tableId: t.tableId,
          blockingSession: t.blockingSession,
          blockingExpiresAt: t.blockingExpiresAt,
        })),
        sessionToken,
      );
    }

    return {
      sessionToken,
      acquiredTables,
      blockedTables,
      expiresAt,
      allAcquired,
    };
  } catch (error) {
    if (error instanceof SoftHoldConflictError) {
      throw error;
    }
    const durationMs = performance.now() - startTime;
    recordObservabilityEvent({
      source: 'capacity.soft_holds',
      eventType: 'acquire.error',
      restaurantId,
      bookingId: bookingId ?? undefined,
      context: {
        sessionToken,
        tableCount: tableIds.length,
        error: error instanceof Error ? error.message : String(error),
        durationMs,
      },
      severity: 'error',
    });
    throw error;
  }
}

/**
 * Releases soft-holds by session token.
 *
 * @param options - Release options
 * @returns Number of soft-holds released
 */
export async function releaseSoftHolds(options: ReleaseSoftHoldsOptions): Promise<number> {
  const { sessionToken, tableIds, client } = options;
  const supabase = ensureClient(client);

  try {
    const { data, error } = await supabase.rpc('release_soft_holds', {
      p_session_token: sessionToken,
      p_table_ids: tableIds ?? null,
    });

    if (error) {
      console.warn('[soft-holds] Failed to release soft-holds', {
        sessionToken,
        error: error.message,
      });
      return 0;
    }

    const count = typeof data === 'number' ? data : 0;

    if (count > 0) {
      recordObservabilityEvent({
        source: 'capacity.soft_holds',
        eventType: 'release.success',
        context: {
          sessionToken,
          releasedCount: count,
          tableIds: tableIds ?? 'all',
        },
        severity: 'info',
      });
    }

    return count;
  } catch (error) {
    console.warn('[soft-holds] Error releasing soft-holds', {
      sessionToken,
      error,
    });
    return 0;
  }
}

/**
 * Checks if a session owns soft-holds for specific tables.
 *
 * @param options - Check options
 * @returns Ownership status for each table
 * @throws SoftHoldExpiredError if any soft-holds have expired
 */
export async function checkSoftHoldOwnership(
  options: CheckSoftHoldOwnershipOptions,
): Promise<SoftHoldOwnershipResult[]> {
  const { sessionToken, tableIds, window, client } = options;
  const supabase = ensureClient(client);
  const windowRange = formatTstzrange(window.startAt, window.endAt);

  const { data, error } = await supabase.rpc('check_soft_hold_ownership', {
    p_session_token: sessionToken,
    p_table_ids: tableIds,
    p_window: windowRange,
  });

  if (error) {
    throw new Error(`Failed to check soft-hold ownership: ${error.message}`);
  }

  const results = (data ?? []) as Array<{
    table_id: string;
    owned: boolean;
    expires_at: string | null;
  }>;

  const ownership: SoftHoldOwnershipResult[] = results.map((row) => ({
    tableId: row.table_id,
    owned: row.owned,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  }));

  // Check for expired soft-holds
  const expiredTables = ownership.filter((o) => !o.owned).map((o) => o.tableId);

  if (expiredTables.length > 0) {
    throw new SoftHoldExpiredError(
      `Soft-holds expired for ${expiredTables.length} table(s)`,
      sessionToken,
      expiredTables,
    );
  }

  return ownership;
}

/**
 * Cleans up expired soft-holds.
 * Should be called periodically (e.g., every minute).
 *
 * @param options - Cleanup options
 * @returns Number of soft-holds cleaned up
 */
export async function cleanupExpiredSoftHolds(options?: {
  batchSize?: number;
  client?: DbClient;
}): Promise<number> {
  const { batchSize = 1000, client } = options ?? {};
  const supabase = ensureClient(client);

  try {
    const { data, error } = await supabase.rpc('cleanup_expired_soft_holds', {
      p_batch_size: batchSize,
    });

    if (error) {
      console.warn('[soft-holds] Failed to cleanup expired soft-holds', {
        error: error.message,
      });
      return 0;
    }

    const count = typeof data === 'number' ? data : 0;

    if (count > 0) {
      recordObservabilityEvent({
        source: 'capacity.soft_holds',
        eventType: 'cleanup.success',
        context: {
          cleanedCount: count,
          batchSize,
        },
        severity: 'info',
      });
    }

    return count;
  } catch (error) {
    console.warn('[soft-holds] Error during cleanup', { error });
    return 0;
  }
}
