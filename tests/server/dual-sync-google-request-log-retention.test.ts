import { describe, expect, it, vi } from 'vitest';

import { pruneExpiredGoogleRequestLogs } from '@/server/dual-sync/publish/google-request-log-retention';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockChain {
  readonly select: ReturnType<typeof vi.fn>;
  readonly lt: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly limit: ReturnType<typeof vi.fn>;
  readonly insert: ReturnType<typeof vi.fn>;
  readonly delete: ReturnType<typeof vi.fn>;
  readonly in: ReturnType<typeof vi.fn>;
  readonly then: (resolve: (value: { data: unknown; error: null }) => unknown) => unknown;
}

function makeChain(result: unknown): MockChain {
  const chain: Partial<MockChain> = {};
  const fluent = vi.fn(() => chain as MockChain);
  Object.assign(chain, {
    select: fluent,
    lt: fluent,
    order: fluent,
    limit: fluent,
    insert: fluent,
    delete: fluent,
    in: fluent,
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: result, error: null })),
  });
  return chain as MockChain;
}

function clientFor(chains: MockChain[]) {
  let index = 0;
  return {
    from: vi.fn(() => {
      const chain = chains[index];
      index += 1;
      if (!chain) throw new Error(`Unexpected from() call ${index}`);
      return chain;
    }),
  } as unknown as SupabaseClient<Database>;
}

function logRow(id: string) {
  return {
    id,
    restaurant_id: 'rest-1',
    provider: 'google_business_profile',
    publish_batch_id: 'batch-1',
    operation_group_id: 'group-1',
    publish_operation_id: 'operation-1',
    publish_job_id: 'job-1',
    section_key: 'profile',
    field_key: 'profile.name',
    direction: 'export_to_google',
    write_group: 'location.profile',
    phase: 'provider_write',
    status: 'succeeded',
    google_method: 'locations.patch',
    google_update_masks: ['profile'],
    request_summary: { fieldKey: 'profile.name' },
    response_summary: { ok: true },
    error_code: null,
    error_message: null,
    retention_expires_at: '2026-05-09T00:00:00.000Z',
    created_at: '2026-04-10T00:00:00.000Z',
  };
}

describe('pruneExpiredGoogleRequestLogs', () => {
  it('archives selected expired rows before deleting only that batch', async () => {
    const selectChain = makeChain([logRow('log-1'), logRow('log-2')]);
    const archiveChain = makeChain([
      { original_request_log_id: 'log-1' },
      { original_request_log_id: 'log-2' },
    ]);
    const deleteChain = makeChain([{ id: 'log-1' }, { id: 'log-2' }]);
    const client = clientFor([selectChain, archiveChain, deleteChain]);

    const result = await pruneExpiredGoogleRequestLogs({
      client,
      now: '2026-05-10T00:00:00.000Z',
      limit: 2,
    });

    expect(client.from).toHaveBeenCalledWith('dual_sync_google_request_logs');
    expect(client.from).toHaveBeenCalledWith('dual_sync_google_request_log_archives');
    expect(selectChain.select).toHaveBeenCalledWith('*');
    expect(selectChain.lt).toHaveBeenCalledWith('retention_expires_at', '2026-05-10T00:00:00.000Z');
    expect(selectChain.order).toHaveBeenCalledWith('retention_expires_at', {
      ascending: true,
    });
    expect(selectChain.limit).toHaveBeenCalledWith(2);
    expect(archiveChain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        original_request_log_id: 'log-1',
        restaurant_id: 'rest-1',
        retention_expires_at: '2026-05-09T00:00:00.000Z',
        original_created_at: '2026-04-10T00:00:00.000Z',
        archived_payload: expect.objectContaining({
          id: 'log-1',
          request_summary: { fieldKey: 'profile.name' },
          response_summary: { ok: true },
        }),
      }),
      expect.objectContaining({
        original_request_log_id: 'log-2',
      }),
    ]);
    expect(archiveChain.select).toHaveBeenCalledWith('original_request_log_id');
    expect(deleteChain.delete).toHaveBeenCalled();
    expect(deleteChain.in).toHaveBeenCalledWith('id', ['log-1', 'log-2']);
    expect(deleteChain.select).toHaveBeenCalledWith('id');
    expect(result).toEqual({
      cutoff: '2026-05-10T00:00:00.000Z',
      limit: 2,
      selected: 2,
      archived: 2,
      deleted: 2,
      moreLikely: true,
    });
  });

  it('does not issue a delete when no expired ids are selected', async () => {
    const selectChain = makeChain([]);
    const client = clientFor([selectChain]);

    const result = await pruneExpiredGoogleRequestLogs({
      client,
      now: '2026-05-10T00:00:00.000Z',
      limit: 10,
    });

    expect(client.from).toHaveBeenCalledOnce();
    expect(result.deleted).toBe(0);
    expect(result.archived).toBe(0);
    expect(result.moreLikely).toBe(false);
  });

  it('caps oversized limits', async () => {
    const selectChain = makeChain([]);
    const client = clientFor([selectChain]);

    await pruneExpiredGoogleRequestLogs({
      client,
      now: '2026-05-10T00:00:00.000Z',
      limit: 99_999,
    });

    expect(selectChain.limit).toHaveBeenCalledWith(5_000);
  });
});
