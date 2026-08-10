import { describe, expect, it, vi } from 'vitest';

import {
  enqueueScheduledRefreshJobs,
  scheduledRefreshBucket,
} from '@/server/dual-sync/scheduling/refresh';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeClient(rows: readonly unknown[]): SupabaseClient<Database> {
  return {
    rpc: vi.fn(async () => ({ data: rows, error: null })),
  } as unknown as SupabaseClient<Database>;
}

describe('scheduled Google refresh queue fan-out', () => {
  it('uses a half-hour time bucket as the only varying idempotency input', () => {
    // Given
    const withinBucket = ['2026-08-09T10:30:00.000Z', '2026-08-09T10:59:59.999Z'];

    // When
    const buckets = withinBucket.map(scheduledRefreshBucket);

    // Then
    expect(buckets).toEqual(['2026-08-09T10:30:00.000Z', '2026-08-09T10:30:00.000Z']);
  });

  it('enqueues reads for at most fifty linked tenants without executing provider work inline', async () => {
    // Given
    const client = makeClient(
      Array.from({ length: 50 }, (_, index) => ({
        restaurant_id: `rest-${index + 1}`,
        job_id: `job-${index + 1}`,
        created: index < 49,
      })),
    );

    // When
    const result = await enqueueScheduledRefreshJobs({
      client,
      now: '2026-08-09T10:42:00.000Z',
      maxRestaurants: 999,
    });

    // Then
    expect(result).toMatchObject({
      considered: 50,
      enqueued: 49,
      bucket: '2026-08-09T10:30:00.000Z',
    });
    expect(client.rpc).toHaveBeenCalledWith('enqueue_gbp_scheduled_refreshes_v1', {
      p_now: '2026-08-09T10:42:00.000Z',
      p_bucket: '2026-08-09T10:30:00.000Z',
      p_limit: 50,
    });
    expect(result.jobIds).toHaveLength(50);
  });
});
