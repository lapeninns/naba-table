import { recordObservabilityEvent } from '@/server/observability';
import { getServiceSupabaseClient } from '@/server/supabase';

import { discoverCoreOutboxCandidates } from './discovery';
import { coreOutboxEntrySchema } from './types';

import type {
  CoreOutboxCensus,
  CoreOutboxClaimHandle,
  CoreOutboxEntry,
  CoreOutboxPorts,
} from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
type OutboxRow = Database['public']['Tables']['gbp_core_change_outbox_v1']['Row'];

export interface SupabaseCoreOutboxPorts extends CoreOutboxPorts {
  readonly census: (limit: number) => Promise<CoreOutboxCensus>;
}

export async function repairMissingCoreOutboxEntries(input: {
  readonly client: DbClient;
  readonly entries: readonly CoreOutboxEntry[];
  readonly operatorUserId: string;
}): Promise<readonly string[]> {
  const repaired: string[] = [];
  for (const entry of input.entries) {
    const { data, error } = await input.client.rpc('repair_gbp_core_change_v1', {
      p_restaurant_id: entry.restaurantId,
      p_outbox_id: entry.id,
      p_idempotency_hash: entry.idempotencyHash,
      p_operator_user_id: input.operatorUserId,
      p_operator_repair: true,
      p_insert_missing: true,
      p_source_table: entry.sourceTable,
      p_source_row_id: entry.sourceRowId,
      p_operation: entry.operation,
      p_field_keys: entry.changedColumns,
      p_before_hash: entry.beforeHash,
      p_after_hash: entry.afterHash,
    });
    if (error) throw error;
    repaired.push(data.id);
  }
  return repaired;
}

function normalizeClaim(row: OutboxRow): CoreOutboxEntry {
  if (row.lease_token === null) {
    throw new TypeError('claimed_core_outbox_row_missing_lease');
  }
  return coreOutboxEntrySchema.parse({
    id: row.id,
    restaurantId: row.restaurant_id,
    sourceTable: row.source_table,
    sourceRowId: row.source_row_id,
    operation: row.operation,
    changedColumns: row.field_keys,
    beforeHash: row.before_hash,
    afterHash: row.after_hash,
    idempotencyHash: row.idempotency_hash,
    attemptCount: row.attempt_count,
    leaseToken: row.lease_token,
  });
}

async function completeEntries(input: {
  readonly client: DbClient;
  readonly entries: readonly CoreOutboxClaimHandle[];
  readonly workerId: string;
  readonly outcome: 'success' | 'retryable_failure';
  readonly errorCode: 'invalid_manifest' | 'reconciliation_required' | null;
}): Promise<readonly OutboxRow[]> {
  const completed: OutboxRow[] = [];
  for (const entry of input.entries) {
    const { data, error } = await input.client.rpc('complete_gbp_core_change_v2', {
      p_restaurant_id: entry.restaurantId,
      p_outbox_id: entry.id,
      p_worker_id: input.workerId,
      p_lease_token: entry.leaseToken,
      p_outcome: input.outcome,
      p_error_code: input.errorCode,
    });
    if (error) throw error;
    completed.push(data);
  }
  return completed;
}

export function createSupabaseCoreOutboxPorts(
  client: DbClient = getServiceSupabaseClient(),
): SupabaseCoreOutboxPorts {
  return {
    claim: async ({ workerId, limit }) => {
      const { data, error } = await client.rpc('claim_gbp_core_changes_v2', {
        p_worker_id: workerId,
        p_limit: Math.min(limit, 100),
        p_lease_seconds: 120,
      });
      if (error) throw error;
      return (data ?? []).map(normalizeClaim);
    },
    complete: async (entries, workerId) => {
      await completeEntries({ client, entries, workerId, outcome: 'success', errorCode: null });
    },
    retry: async (entries, workerId, errorCode) => {
      const rows = await completeEntries({
        client,
        entries,
        workerId,
        outcome: 'retryable_failure',
        errorCode:
          errorCode === 'invalid_outbox_schema' ? 'invalid_manifest' : 'reconciliation_required',
      });
      return {
        deadLetterIds: rows.filter((row) => row.status === 'dead_letter').map((row) => row.id),
      };
    },
    isProviderOrigin: async (entry) => {
      const { data, error } = await client
        .from('gbp_field_provenance_v1')
        .select('id')
        .eq('restaurant_id', entry.restaurantId)
        .eq('source_table', entry.sourceTable)
        .eq('source_row_id', entry.sourceRowId)
        .eq('source', 'google')
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    discoverCandidates: async (input) => discoverCoreOutboxCandidates({ client, ...input }),
    notifyDeadLetters: async (ids, errorCode) => {
      await recordObservabilityEvent({
        source: 'dual-sync.core-outbox',
        eventType: 'dead-letter.created',
        severity: 'error',
        context: { outboxIds: [...ids], count: ids.length, errorCode },
      });
    },
    census: async (limit) => {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('gbp_core_change_outbox_v1')
        .select('status,available_at,lease_expires_at')
        .in('status', ['pending', 'claimed', 'dead_letter'])
        .order('created_at', { ascending: true })
        .limit(Math.min(limit, 100));
      if (error) throw error;
      const rows = data ?? [];
      return {
        pending: rows.filter((row) => row.status === 'pending' && row.available_at <= now).length,
        claimed: rows.filter((row) => row.status === 'claimed').length,
        retryable: rows.filter((row) => row.status === 'pending' && row.available_at > now).length,
        deadLetter: rows.filter((row) => row.status === 'dead_letter').length,
      };
    },
  };
}
