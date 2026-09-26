import { processOutboxBatch, type OutboxBatchSummary } from '@/server/outbox';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

export type OutboxWorkerSummary = Omit<OutboxBatchSummary, 'pending'> & { batches: number };

export async function runOutboxWorker(params?: {
  limit?: number;
  client?: DbClient;
}): Promise<OutboxWorkerSummary> {
  const client = params?.client ?? getServiceSupabaseClient();
  const limit = params?.limit ?? 100;
  const totals: OutboxWorkerSummary = { processed: 0, failed: 0, dead: 0, batches: 0 };

  // Drain a few batches with jittered pauses. Each batch is claimed atomically, so
  // several workers can run this loop at once without double-processing a row.
  for (let i = 0; i < 5; i += 1) {
    const batch = await processOutboxBatch({ limit, client });
    totals.batches += 1;
    totals.processed += batch.processed;
    totals.failed += batch.failed;
    totals.dead += batch.dead;
    if (batch.error) {
      totals.error = batch.error;
      break;
    }
    if (batch.processed === 0 && batch.failed === 0 && batch.dead === 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));
  }

  return totals;
}
