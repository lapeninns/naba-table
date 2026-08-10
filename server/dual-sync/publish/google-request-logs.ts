/**
 * Durable, redacted Google request/response summaries for dual-sync.
 *
 * This table is intentionally summary-oriented: callers provide operator-useful
 * metadata and this helper sanitizes nested JSON before persistence.
 */

import { DateTime } from 'luxon';

import { getDualSyncDbClient, type DualSyncGoogleRequestLogRow } from '../db';
import {
  type DualSyncGoogleRequestLog,
  type DualSyncGoogleRequestLogPhase,
  type DualSyncGoogleUpdateMask,
  type DualSyncSectionKey,
  isDualSyncSectionKey,
} from '../types';

import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,99}$/;

function safeErrorCode(value: string | null | undefined): string | null {
  return typeof value === 'string' && SAFE_ERROR_CODE.test(value) ? value : null;
}

function rowToGoogleRequestLog(row: DualSyncGoogleRequestLogRow): DualSyncGoogleRequestLog {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: row.provider,
    publishBatchId: row.publish_batch_id,
    operationGroupId: row.operation_group_id,
    publishOperationId: row.publish_operation_id,
    publishJobId: row.publish_job_id,
    sectionKey: row.section_key && isDualSyncSectionKey(row.section_key) ? row.section_key : null,
    fieldKey: row.field_key,
    direction: row.direction,
    writeGroup: row.write_group,
    phase: row.phase,
    status: row.status,
    googleMethod: row.google_method,
    googleUpdateMasks: row.google_update_masks as DualSyncGoogleUpdateMask[],
    requestSummary: row.request_summary,
    responseSummary: row.response_summary,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retentionExpiresAt: row.retention_expires_at,
    createdAt: row.created_at,
  };
}

export interface CreateGoogleRequestLogInput {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly publishBatchId?: string | null;
  readonly operationGroupId?: string | null;
  readonly publishOperationId?: string | null;
  readonly publishJobId?: string | null;
  readonly sectionKey?: DualSyncSectionKey | null;
  readonly fieldKey?: string | null;
  readonly direction?: 'import_from_google' | 'export_to_google' | null;
  readonly writeGroup?: string | null;
  readonly phase: DualSyncGoogleRequestLogPhase;
  readonly status?: string | null;
  readonly googleMethod?: string | null;
  readonly googleUpdateMasks?: ReadonlyArray<DualSyncGoogleUpdateMask>;
  readonly requestSummary?: unknown;
  readonly responseSummary?: unknown;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
  readonly retentionExpiresAt?: string | null;
}

export class GoogleRequestLogRetentionError extends Error {
  constructor() {
    super('Google request-log retention expiry must be a valid inherited timestamp');
    this.name = 'GoogleRequestLogRetentionError';
  }
}

export async function createGoogleRequestLog(
  input: CreateGoogleRequestLogInput,
): Promise<DualSyncGoogleRequestLog> {
  if (
    input.retentionExpiresAt !== null &&
    input.retentionExpiresAt !== undefined &&
    !DateTime.fromISO(input.retentionExpiresAt, { setZone: true }).isValid
  ) {
    throw new GoogleRequestLogRetentionError();
  }
  const dual = getDualSyncDbClient(input.client);
  const insert: Partial<DualSyncGoogleRequestLogRow> &
    Pick<DualSyncGoogleRequestLogRow, 'restaurant_id' | 'phase'> = {
    restaurant_id: input.restaurantId,
    provider: 'google_business_profile',
    publish_batch_id: input.publishBatchId ?? null,
    operation_group_id: input.operationGroupId ?? null,
    publish_operation_id: input.publishOperationId ?? null,
    publish_job_id: input.publishJobId ?? null,
    section_key: input.sectionKey ?? null,
    field_key: input.fieldKey ?? null,
    direction: input.direction ?? null,
    write_group: input.writeGroup ?? null,
    phase: input.phase,
    status: input.status ?? null,
    google_method: input.googleMethod ?? null,
    google_update_masks: [...(input.googleUpdateMasks ?? [])],
    request_summary: {} as Json,
    response_summary: null,
    error_code: safeErrorCode(input.errorCode),
    error_message: null,
  };
  insert.retention_expires_at = input.retentionExpiresAt ?? null;

  const { data, error } = await dual
    .from('dual_sync_google_request_logs')
    .insert(insert as never)
    .select('*')
    .single<DualSyncGoogleRequestLogRow>();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('dual_sync_google_request_logs insert returned no row');
  }
  return rowToGoogleRequestLog(data);
}
