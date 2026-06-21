/**
 * Google write safety utilities for unified dual-sync publishes.
 *
 * Google documents a tight per-profile edit budget, so export execution
 * needs an explicit throttle before provider calls. This module keeps the
 * contract injectable for tests and future durable queue integration.
 */

import type { DualSyncOperationFailure } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DualSyncGoogleEditThrottleDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number | null;
  readonly remaining: number | null;
}

export interface DualSyncGoogleEditThrottle {
  readonly reserve: (input: {
    readonly restaurantId: string;
    readonly writeGroup: string;
    readonly nowMs?: number;
  }) => Promise<DualSyncGoogleEditThrottleDecision>;
}

export class InMemoryDualSyncGoogleEditThrottle implements DualSyncGoogleEditThrottle {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async reserve(input: {
    readonly restaurantId: string;
    readonly writeGroup: string;
    readonly nowMs?: number;
  }): Promise<DualSyncGoogleEditThrottleDecision> {
    const now = input.nowMs ?? Date.now();
    const key = `${input.restaurantId}:google_business_profile`;
    const cutoff = now - this.windowMs;
    const active = (this.buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (active.length >= this.limit) {
      const oldest = active[0] ?? now;
      return {
        allowed: false,
        retryAfterMs: Math.max(oldest + this.windowMs - now, 1),
        remaining: 0,
      };
    }
    active.push(now);
    this.buckets.set(key, active);
    return {
      allowed: true,
      retryAfterMs: null,
      remaining: Math.max(this.limit - active.length, 0),
    };
  }
}

export const defaultDualSyncGoogleEditThrottle = new InMemoryDualSyncGoogleEditThrottle(10, 60_000);

interface SupabaseRpcError {
  readonly message?: string;
}

type GoogleEditBudgetRpcClient = {
  readonly rpc: (
    functionName: 'dual_sync_reserve_google_edit_budget',
    args: {
      readonly p_restaurant_id: string;
      readonly p_write_group: string;
      readonly p_limit: number;
      readonly p_window_ms: number;
      readonly p_now?: string;
    },
  ) => Promise<{
    readonly data: unknown;
    readonly error: SupabaseRpcError | null;
  }>;
};

interface GoogleEditBudgetRpcRow {
  readonly allowed?: unknown;
  readonly retry_after_ms?: unknown;
  readonly remaining?: unknown;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstRpcRow(data: unknown): GoogleEditBudgetRpcRow | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === 'object' ? (first as GoogleEditBudgetRpcRow) : null;
  }
  return data && typeof data === 'object' ? (data as GoogleEditBudgetRpcRow) : null;
}

export class SupabaseDualSyncGoogleEditThrottle implements DualSyncGoogleEditThrottle {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly limit = 10,
    private readonly windowMs = 60_000,
  ) {}

  async reserve(input: {
    readonly restaurantId: string;
    readonly writeGroup: string;
    readonly nowMs?: number;
  }): Promise<DualSyncGoogleEditThrottleDecision> {
    const rpcClient = this.client as unknown as GoogleEditBudgetRpcClient;
    const args = {
      p_restaurant_id: input.restaurantId,
      p_write_group: input.writeGroup,
      p_limit: this.limit,
      p_window_ms: this.windowMs,
      ...(input.nowMs === undefined ? {} : { p_now: new Date(input.nowMs).toISOString() }),
    };
    const { data, error } = await rpcClient.rpc('dual_sync_reserve_google_edit_budget', {
      ...args,
    });
    if (error) {
      throw new Error(error.message || 'Could not reserve Google edit budget.');
    }
    const row = firstRpcRow(data);
    if (!row) {
      throw new Error('Google edit budget reservation returned no row.');
    }
    return {
      allowed: row.allowed === true,
      retryAfterMs: parseNumber(row.retry_after_ms),
      remaining: parseNumber(row.remaining),
    };
  }
}

export function createDurableDualSyncGoogleEditThrottle(
  client: SupabaseClient<Database>,
  options: { readonly limit?: number; readonly windowMs?: number } = {},
): DualSyncGoogleEditThrottle {
  return new SupabaseDualSyncGoogleEditThrottle(
    client,
    options.limit ?? 10,
    options.windowMs ?? 60_000,
  );
}

export async function reserveGoogleEditBudget(input: {
  readonly throttle: DualSyncGoogleEditThrottle | null | undefined;
  readonly restaurantId: string;
  readonly writeGroup: string;
}): Promise<DualSyncOperationFailure | null> {
  if (!input.throttle) return null;
  let decision: DualSyncGoogleEditThrottleDecision;
  try {
    decision = await input.throttle.reserve({
      restaurantId: input.restaurantId,
      writeGroup: input.writeGroup,
    });
  } catch (error) {
    return {
      code: 'QUOTA_LIMITED',
      message:
        error instanceof Error
          ? `Could not reserve Google edit budget: ${error.message}`
          : 'Could not reserve Google edit budget.',
      retryable: true,
    };
  }
  if (decision.allowed) return null;
  return {
    code: 'QUOTA_LIMITED',
    message: `Google edit budget is exhausted for this location. Retry after ${decision.retryAfterMs ?? 60000}ms.`,
    retryable: true,
  };
}
