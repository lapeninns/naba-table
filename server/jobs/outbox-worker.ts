import { processOutboxBatch } from "@/server/outbox";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

export async function runOutboxWorker(params?: { limit?: number; client?: DbClient }): Promise<void> {
  const client = params?.client ?? getServiceSupabaseClient();
  const limit = params?.limit ?? 100;

  // Process a few batches with jittered backoff to drain queue
  for (let i = 0; i < 5; i += 1) {
    const { processed, failed } = await processOutboxBatch({ limit, client });
    if (processed === 0 && failed === 0) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 150));
  }
}

