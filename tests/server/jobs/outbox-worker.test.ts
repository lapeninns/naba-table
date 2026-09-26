import { beforeEach, describe, expect, it, vi } from 'vitest';

const processOutboxBatchMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/outbox', () => ({ processOutboxBatch: processOutboxBatchMock }));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: vi.fn(() => ({})) }));

import { runOutboxWorker } from '@/server/jobs/outbox-worker';

describe('runOutboxWorker', () => {
  beforeEach(() => {
    processOutboxBatchMock.mockReset();
  });

  it('drains batches until the queue is empty and reports totals', async () => {
    processOutboxBatchMock
      .mockResolvedValueOnce({ processed: 3, failed: 1, dead: 0, pending: 1 })
      .mockResolvedValueOnce({ processed: 0, failed: 0, dead: 1, pending: 1 })
      .mockResolvedValueOnce({ processed: 0, failed: 0, dead: 0, pending: 0 });

    await expect(runOutboxWorker({ client: {} as never, limit: 5 })).resolves.toEqual({
      processed: 3,
      failed: 1,
      dead: 1,
      batches: 3,
    });
    expect(processOutboxBatchMock).toHaveBeenCalledWith({ limit: 5, client: {} });
  });

  it('stops and reports when the atomic claim fails', async () => {
    processOutboxBatchMock.mockResolvedValue({
      processed: 0,
      failed: 0,
      dead: 0,
      pending: 0,
      error: 'CLAIM_FAILED',
    });

    await expect(runOutboxWorker({ client: {} as never })).resolves.toEqual({
      processed: 0,
      failed: 0,
      dead: 0,
      batches: 1,
      error: 'CLAIM_FAILED',
    });
    expect(processOutboxBatchMock).toHaveBeenCalledTimes(1);
  });
});
