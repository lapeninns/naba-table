/**
 * Bounded retention for redacted Google request-log summaries.
 *
 * Content summaries are deleted directly. They must never be copied into the
 * legacy archive because that would reset recoverability and launder content.
 */

import { getDualSyncDbClient, type DualSyncGoogleRequestLogRow } from '../db';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

const DEFAULT_LIMIT = 1_000;
const MAX_LIMIT = 5_000;

function normalizeLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(value ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

export interface PruneExpiredGoogleRequestLogsInput {
  readonly client: DbClient;
  readonly now?: string;
  readonly limit?: number;
  readonly dryRun?: boolean;
}

export interface PruneExpiredGoogleRequestLogsResult {
  readonly cutoff: string;
  readonly limit: number;
  readonly selected: number;
  readonly archived: number;
  readonly deleted: number;
  readonly moreLikely: boolean;
}

export async function pruneExpiredGoogleRequestLogs(
  input: PruneExpiredGoogleRequestLogsInput,
): Promise<PruneExpiredGoogleRequestLogsResult> {
  const dual = getDualSyncDbClient(input.client);
  const cutoff = input.now ?? new Date().toISOString();
  const limit = normalizeLimit(input.limit);

  const { data: rows, error: selectError } = await dual
    .from('dual_sync_google_request_logs')
    .select('id,retention_expires_at')
    .lt('retention_expires_at', cutoff)
    .order('retention_expires_at', { ascending: true })
    .limit(limit);
  if (selectError) {
    throw selectError;
  }

  const selectedRows: DualSyncGoogleRequestLogRow[] = Array.isArray(rows)
    ? (rows as DualSyncGoogleRequestLogRow[])
    : [];
  const ids = selectedRows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) {
    return {
      cutoff,
      limit,
      selected: 0,
      archived: 0,
      deleted: 0,
      moreLikely: false,
    };
  }
  if (input.dryRun) {
    return {
      cutoff,
      limit,
      selected: ids.length,
      archived: 0,
      deleted: 0,
      moreLikely: ids.length === limit,
    };
  }

  const { data: deletedRows, error: deleteError } = await dual
    .from('dual_sync_google_request_logs')
    .delete()
    .in('id', ids)
    .select('id');
  if (deleteError) {
    throw deleteError;
  }

  return {
    cutoff,
    limit,
    selected: ids.length,
    archived: 0,
    deleted: deletedRows?.length ?? ids.length,
    moreLikely: ids.length === limit,
  };
}
