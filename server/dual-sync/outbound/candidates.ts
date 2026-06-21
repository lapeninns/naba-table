/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Outbound candidate store. Phase 2 will wire this into Core writers so
 * that `applyCoreWrite(field, oldVal, newVal)` always produces or updates
 * the open candidate row for the affected `(restaurant, provider, field)`.
 *
 * The store is intentionally minimal: it does not own field-state
 * transitions (that lives in `state/write.ts`) and does not enforce
 * direction policies (that lives in the registry capability resolver).
 */

import { getDualSyncDbClient, type DualSyncOutboundCandidateRow } from '../db';
import {
  DUAL_SYNC_PROVIDER,
  type DualSyncOutboundCandidate,
  type DualSyncOutboundSource,
  type DualSyncOutboundStatus,
  type DualSyncSectionKey,
} from '../types';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type SupabaseErrorLike = { code?: string; message?: string };

function isUniqueConstraintError(error: SupabaseErrorLike): boolean {
  return (
    error.code === '23505' || /duplicate key value|unique constraint/i.test(error.message ?? '')
  );
}

function rowToCandidate(row: DualSyncOutboundCandidateRow): DualSyncOutboundCandidate {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    sectionKey: row.section_key as DualSyncSectionKey,
    fieldKey: row.field_key,
    proposedValue: row.proposed_value ?? null,
    proposedValueHash: row.proposed_value_hash,
    baselineGbpHash: row.baseline_gbp_hash,
    status: row.status,
    source: row.source,
    createdByUserId: row.created_by_user_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpsertOutboundCandidateInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly sectionKey: DualSyncSectionKey;
  readonly fieldKey: string;
  readonly proposedValue: unknown;
  readonly proposedValueHash: string | null;
  readonly baselineGbpHash: string | null;
  readonly source?: DualSyncOutboundSource;
  readonly createdByUserId?: string | null;
}

/**
 * Open or refresh the single open candidate for `(restaurant, provider,
 * field)`. If an existing candidate is open, its proposed value and
 * baseline are updated. Resolved/cancelled rows stay as-is for audit.
 */
export async function upsertOutboundCandidate({
  client,
  restaurantId,
  sectionKey,
  fieldKey,
  proposedValue,
  proposedValueHash,
  baselineGbpHash,
  source = 'core_write',
  createdByUserId,
}: UpsertOutboundCandidateInput): Promise<DualSyncOutboundCandidate> {
  const dual = getDualSyncDbClient(client);
  const candidatePatch = {
    proposed_value: proposedValue as Json,
    proposed_value_hash: proposedValueHash,
    baseline_gbp_hash: baselineGbpHash,
    source,
    created_by_user_id: createdByUserId ?? null,
  } as const;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: existing, error: existingError } = await dual
      .from('dual_sync_outbound_candidates')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('provider', DUAL_SYNC_PROVIDER)
      .eq('field_key', fieldKey)
      .eq('status', 'open')
      .maybeSingle<DualSyncOutboundCandidateRow>();
    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { data, error } = await dual
        .from('dual_sync_outbound_candidates')
        .update({
          ...candidatePatch,
          created_by_user_id: createdByUserId ?? existing.created_by_user_id,
        } as never)
        .eq('id', existing.id)
        .eq('status', 'open')
        .select('*')
        .maybeSingle<DualSyncOutboundCandidateRow>();
      if (error) {
        throw error;
      }
      if (data) {
        return rowToCandidate(data);
      }
      continue;
    }

    const { data, error } = await dual
      .from('dual_sync_outbound_candidates')
      .insert({
        restaurant_id: restaurantId,
        provider: DUAL_SYNC_PROVIDER,
        section_key: sectionKey,
        field_key: fieldKey,
        ...candidatePatch,
        status: 'open' satisfies DualSyncOutboundStatus,
      } as never)
      .select('*')
      .single<DualSyncOutboundCandidateRow>();
    if (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
    if (!data) {
      throw new Error('dual_sync_outbound_candidates insert returned no row');
    }
    return rowToCandidate(data);
  }

  throw new Error(
    `dual_sync_outbound_candidates upsert raced repeatedly for ${restaurantId}:${fieldKey}`,
  );
}

export interface ResolveOutboundCandidateInput {
  readonly client: DbClient;
  readonly id: string;
  readonly nextStatus: Exclude<DualSyncOutboundStatus, 'open'>;
}

export async function resolveOutboundCandidate({
  client,
  id,
  nextStatus,
}: ResolveOutboundCandidateInput): Promise<DualSyncOutboundCandidate> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_outbound_candidates')
    .update({
      status: nextStatus,
      resolved_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select('*')
    .single<DualSyncOutboundCandidateRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error(`dual_sync_outbound_candidates resolve failed for ${id}`);
  }
  return rowToCandidate(data);
}

export async function listOpenOutboundCandidates({
  client,
  restaurantId,
}: {
  readonly client: DbClient;
  readonly restaurantId: string;
}): Promise<ReadonlyArray<DualSyncOutboundCandidate>> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_outbound_candidates')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('status', 'open')
    .order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToCandidate);
}

export interface ListOutboundCandidatesInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly statuses?: ReadonlyArray<DualSyncOutboundStatus>;
  readonly limit?: number;
}

export async function listOutboundCandidates({
  client,
  restaurantId,
  statuses,
  limit,
}: ListOutboundCandidatesInput): Promise<ReadonlyArray<DualSyncOutboundCandidate>> {
  const dual = getDualSyncDbClient(client);
  let query = dual
    .from('dual_sync_outbound_candidates')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .order('updated_at', { ascending: false });
  if (statuses && statuses.length > 0) {
    query = query.in('status', [...statuses]);
  }
  query = query.limit(Math.min(Math.max(limit ?? 50, 1), 200));
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map(rowToCandidate);
}

export interface CancelOutboundCandidateInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly candidateId: string;
  readonly resolvedAt?: string;
}

export async function cancelOutboundCandidate({
  client,
  restaurantId,
  candidateId,
  resolvedAt,
}: CancelOutboundCandidateInput): Promise<DualSyncOutboundCandidate | null> {
  const dual = getDualSyncDbClient(client);
  const { data, error } = await dual
    .from('dual_sync_outbound_candidates')
    .update({
      status: 'cancelled' satisfies DualSyncOutboundStatus,
      resolved_at: resolvedAt ?? new Date().toISOString(),
    } as never)
    .eq('id', candidateId)
    .eq('restaurant_id', restaurantId)
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('status', 'open')
    .select('*')
    .maybeSingle<DualSyncOutboundCandidateRow>();
  if (error) {
    throw error;
  }
  return data ? rowToCandidate(data) : null;
}

/**
 * Discover the distinct restaurant ids that currently have at least one
 * open outbound candidate. Used by the cross-tenant cron handler to
 * fan out work without scanning every restaurant in the catalog.
 *
 * Results are de-duped client-side; the table-level index on
 * `(restaurant_id, provider, status)` keeps the read cheap.
 */
export async function listRestaurantsWithOpenOutboundCandidates({
  client,
  limit,
}: {
  readonly client: DbClient;
  readonly limit?: number;
}): Promise<ReadonlyArray<string>> {
  const dual = getDualSyncDbClient(client);
  let query = dual
    .from('dual_sync_outbound_candidates')
    .select('restaurant_id')
    .eq('provider', DUAL_SYNC_PROVIDER)
    .eq('status', 'open')
    .order('updated_at', { ascending: false });
  if (typeof limit === 'number' && limit > 0) {
    // Pull a generous batch and de-dupe; the row-level limit is the cap.
    query = query.limit(Math.min(limit * 4, 1000));
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { restaurant_id?: string | null }).restaurant_id;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (typeof limit === 'number' && out.length >= limit) break;
  }
  return out;
}
