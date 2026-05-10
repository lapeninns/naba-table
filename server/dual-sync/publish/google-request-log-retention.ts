/**
 * Bounded retention for redacted Google request-log summaries.
 *
 * The helper selects expired rows first, archives only that selected set, then
 * deletes only those ids so a cron tick cannot accidentally remove an unbounded
 * amount of audit data.
 */

import { getDualSyncDbClient, type DualSyncGoogleRequestLogRow } from '../db';

import type { Database, Json } from '@/types/supabase';
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
}

export interface PruneExpiredGoogleRequestLogsResult {
  readonly cutoff: string;
  readonly limit: number;
  readonly selected: number;
  readonly archived: number;
  readonly deleted: number;
  readonly moreLikely: boolean;
}

function archivePayload(row: DualSyncGoogleRequestLogRow): Json {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    provider: row.provider,
    publish_batch_id: row.publish_batch_id,
    operation_group_id: row.operation_group_id,
    publish_operation_id: row.publish_operation_id,
    publish_job_id: row.publish_job_id,
    section_key: row.section_key,
    field_key: row.field_key,
    direction: row.direction,
    write_group: row.write_group,
    phase: row.phase,
    status: row.status,
    google_method: row.google_method,
    google_update_masks: row.google_update_masks,
    request_summary: row.request_summary,
    response_summary: row.response_summary,
    error_code: row.error_code,
    error_message: row.error_message,
    retention_expires_at: row.retention_expires_at,
    created_at: row.created_at,
  } as Json;
}

export async function pruneExpiredGoogleRequestLogs(
  input: PruneExpiredGoogleRequestLogsInput,
): Promise<PruneExpiredGoogleRequestLogsResult> {
  const dual = getDualSyncDbClient(input.client);
  const cutoff = input.now ?? new Date().toISOString();
  const limit = normalizeLimit(input.limit);

  const { data: rows, error: selectError } = await dual
    .from('dual_sync_google_request_logs')
    .select('*')
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

  const archiveRows = selectedRows
    .filter((row) => ids.includes(row.id))
    .map((row) => ({
      original_request_log_id: row.id,
      restaurant_id: row.restaurant_id,
      provider: row.provider,
      retention_expires_at: row.retention_expires_at,
      original_created_at: row.created_at,
      archived_payload: archivePayload(row),
    }));

  const { data: archivedRows, error: archiveError } = await dual
    .from('dual_sync_google_request_log_archives')
    .insert(archiveRows as never)
    .select('original_request_log_id');
  if (archiveError) {
    throw archiveError;
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
    archived: archivedRows?.length ?? archiveRows.length,
    deleted: deletedRows?.length ?? ids.length,
    moreLikely: ids.length === limit,
  };
}
