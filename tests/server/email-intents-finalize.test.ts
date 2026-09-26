import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const processEmailJobsMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ rpc: rpcMock, from: fromMock }),
}));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));
vi.mock('@/server/queue/email-processing', () => ({
  processEmailJobs: processEmailJobsMock,
}));

import {
  cancelEmailIntentForRestaurant,
  drainDueEmailIntents,
  requeueFailedEmailIntentForRestaurant,
} from '@/server/queue/email-intents';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function claimedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'intent-1',
    dedupe_key: 'email__reminder_24h__booking-1',
    booking_id: 'booking-1',
    restaurant_id: RESTAURANT_ID,
    email_type: 'reminder_24h',
    scheduled_for: '2026-09-26T10:00:00.000Z',
    status: 'processing',
    attempts_made: 1,
    claim_generation: 7,
    max_attempts: 5,
    backoff_type: 'exponential',
    backoff_delay_ms: 60_000,
    claimed_at: '2026-09-26T10:00:01.000Z',
    last_attempt_at: '2026-09-26T10:00:01.000Z',
    processed_at: null,
    cancelled_at: null,
    last_error: null,
    review_request_id: null,
    payload: { bookingId: 'booking-1', restaurantId: RESTAURANT_ID, type: 'reminder_24h' },
    created_at: '2026-09-25T10:00:00.000Z',
    updated_at: '2026-09-26T10:00:01.000Z',
    ...overrides,
  };
}

function mockDrain(row: Record<string, unknown>, finalizeRows: unknown[]) {
  rpcMock.mockImplementation(async (name: string) => {
    if (name === 'claim_due_email_dispatch_intents') return { data: [row], error: null };
    if (name === 'finalize_email_dispatch_intent_v2') return { data: finalizeRows, error: null };
    if (name === 'finalize_email_dispatch_intent_v1') return { data: finalizeRows, error: null };
    throw new Error(`unexpected rpc ${name}`);
  });
}

function finalizeCall(name = 'finalize_email_dispatch_intent_v2') {
  const call = rpcMock.mock.calls.find(([called]) => called === name);
  expect(call).toBeDefined();
  return call![1] as Record<string, unknown>;
}

describe('email intent finalize fencing', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    processEmailJobsMock.mockReset();
    recordObservabilityEventMock.mockReset().mockResolvedValue(undefined);
  });

  it('finalizes a sent job only for the claimed generation', async () => {
    const row = claimedRow();
    mockDrain(row, [{ ...row, status: 'sent' }]);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 1, skipped: 0, failed: 0 },
      results: [{ jobId: 'intent-1', success: true }],
    });

    const result = await drainDueEmailIntents();

    expect(result.processed).toBe(1);
    expect(finalizeCall()).toEqual(
      expect.objectContaining({
        p_intent_id: 'intent-1',
        p_claim_generation: 7,
        p_status: 'sent',
      }),
    );
    expect(finalizeCall()).not.toHaveProperty('p_attempt');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('fences on the monotonic claim generation, not the resettable attempt number (ABA)', async () => {
    // scheduleEmailIntent reset attempts_made to 0, so this re-claim is attempt 1 again. Only the
    // claim generation distinguishes it from the stale worker that also held attempt 1.
    const row = claimedRow({ attempts_made: 1, claim_generation: 2 });
    mockDrain(row, [{ ...row, status: 'sent' }]);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 1, skipped: 0, failed: 0 },
      results: [{ jobId: 'intent-1', success: true }],
    });

    await drainDueEmailIntents();

    expect(finalizeCall()).toMatchObject({ p_claim_generation: 2 });
    expect(rpcMock).not.toHaveBeenCalledWith(
      'finalize_email_dispatch_intent_v1',
      expect.anything(),
    );
  });

  it('falls back to the attempt fence while the claim-generation migration is not applied', async () => {
    const legacyRow: Record<string, unknown> = { ...claimedRow() };
    delete legacyRow.claim_generation;
    mockDrain(legacyRow, [{ ...legacyRow, status: 'sent' }]);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 1, skipped: 0, failed: 0 },
      results: [{ jobId: 'intent-1', success: true }],
    });

    await drainDueEmailIntents();

    expect(finalizeCall('finalize_email_dispatch_intent_v1')).toMatchObject({
      p_attempt: 1,
      p_status: 'sent',
    });
  });

  it('does not overwrite a job cancelled while it was processing (lost race)', async () => {
    const row = claimedRow();
    mockDrain(row, []);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 1, skipped: 0, failed: 0 },
      results: [{ jobId: 'intent-1', success: true }],
    });

    await expect(drainDueEmailIntents()).resolves.toMatchObject({ processed: 1 });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'email_queue.finalize_superseded' }),
    );
  });

  it('fails terminal errors immediately instead of retrying them', async () => {
    const row = claimedRow({ attempts_made: 1, max_attempts: 5 });
    mockDrain(row, [{ ...row, status: 'failed' }]);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 0, skipped: 0, failed: 1 },
      results: [{ jobId: 'intent-1', success: false, terminal: true, error: 'INVALID_RECIPIENT' }],
    });

    await drainDueEmailIntents();

    expect(finalizeCall()).toMatchObject({
      p_status: 'failed',
      p_last_error: 'INVALID_RECIPIENT',
    });
  });

  it('reschedules retryable errors with backoff while attempts remain', async () => {
    const row = claimedRow({ attempts_made: 2, max_attempts: 5 });
    mockDrain(row, [{ ...row, status: 'pending' }]);
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 0, skipped: 0, failed: 1 },
      results: [{ jobId: 'intent-1', success: false, error: 'EMAIL_JOB_FAILED' }],
    });

    await drainDueEmailIntents();

    const args = finalizeCall();
    expect(args).toMatchObject({ p_status: 'pending', p_claim_generation: 7 });
    expect(typeof args.p_next_scheduled_for).toBe('string');
  });
});

function chain(result: { data: unknown; error: unknown }) {
  const node: Record<string, unknown> = {};
  for (const method of ['update', 'select', 'eq', 'in', 'is']) {
    node[method] = vi.fn(() => node);
  }
  node.maybeSingle = vi.fn(async () => result);
  return node as Record<string, ReturnType<typeof vi.fn>>;
}

describe('restaurant queue job cancel and requeue', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it('refuses to cancel a job that is being processed', async () => {
    const cancelUpdate = chain({ data: null, error: null });
    const lookup = chain({ data: { id: 'intent-1', status: 'processing' }, error: null });
    fromMock.mockReturnValueOnce(cancelUpdate).mockReturnValueOnce(lookup);

    await expect(
      cancelEmailIntentForRestaurant({ dedupeKey: 'job-1', restaurantId: RESTAURANT_ID }),
    ).resolves.toBe('in_progress');
    expect(cancelUpdate.in).not.toHaveBeenCalled();
    expect(cancelUpdate.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('cancels a pending job', async () => {
    fromMock.mockReturnValueOnce(chain({ data: { id: 'intent-1' }, error: null }));

    await expect(
      cancelEmailIntentForRestaurant({ dedupeKey: 'job-1', restaurantId: RESTAURANT_ID }),
    ).resolves.toBe('cancelled');
  });

  it('reports jobs that are already finished as not cancellable', async () => {
    fromMock
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: { id: 'intent-1', status: 'sent' }, error: null }));

    await expect(
      cancelEmailIntentForRestaurant({ dedupeKey: 'job-1', restaurantId: RESTAURANT_ID }),
    ).resolves.toBe('not_cancellable');
  });

  it('resets attempts when a failed job is requeued', async () => {
    const update = chain({ data: { id: 'intent-1' }, error: null });
    fromMock.mockReturnValueOnce(update);

    await expect(
      requeueFailedEmailIntentForRestaurant({ dedupeKey: 'job-1', restaurantId: RESTAURANT_ID }),
    ).resolves.toBe('requeued');
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', attempts_made: 0, last_error: null }),
    );
    // The claim generation is the finalize fence: it must never be reset.
    expect(update.update.mock.calls[0][0]).not.toHaveProperty('claim_generation');
    expect(update.eq).toHaveBeenCalledWith('status', 'failed');
  });

  it('reports a job that is not failed as not requeueable', async () => {
    fromMock
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: { id: 'intent-1', status: 'pending' }, error: null }));

    await expect(
      requeueFailedEmailIntentForRestaurant({ dedupeKey: 'job-1', restaurantId: RESTAURANT_ID }),
    ).resolves.toBe('not_requeueable');
  });
});
