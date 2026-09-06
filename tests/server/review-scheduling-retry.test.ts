import { beforeEach, describe, expect, it, vi } from 'vitest';
const schedule = vi.hoisted(() => vi.fn());
vi.mock('@/server/jobs/booking-side-effects', () => ({ enqueueCheckOutSideEffects: schedule }));
import { drainReviewSchedulingJobs } from '@/server/reviews/scheduling-retry';

function fixture(status = 'completed') {
  const eq = vi.fn().mockReturnThis();
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({
      data: [{ booking_id: 'booking-a', restaurant_id: 'tenant-a', claim_token: 'lease-a' }],
      error: null,
    })
    .mockResolvedValue({ data: true, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'booking-a', status }, error: null });
  const client = { rpc, from: vi.fn(() => ({ select: () => ({ eq, maybeSingle }) })) };
  return { client, rpc, eq, maybeSingle };
}

describe('durable review scheduling worker', () => {
  beforeEach(() => {
    schedule.mockReset();
    schedule.mockResolvedValue(undefined);
  });
  it('loads the current booking in its tenant and acknowledges only after durable scheduling', async () => {
    const { client, rpc, eq } = fixture();
    expect(await drainReviewSchedulingJobs({ client: client as never })).toEqual({
      processed: 1,
      failed: 0,
    });
    expect(eq.mock.calls).toEqual([
      ['id', 'booking-a'],
      ['restaurant_id', 'tenant-a'],
    ]);
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      'tenant-a',
      { supabase: client, retryOnFailure: true },
    );
    expect(rpc).toHaveBeenLastCalledWith('finish_review_scheduling_job_v1', {
      p_booking_id: 'booking-a',
      p_restaurant_id: 'tenant-a',
      p_claim_token: 'lease-a',
      p_error_code: null,
    });
  });
  it('retains failed work with a safe SQLSTATE for a later run', async () => {
    const { client, rpc } = fixture();
    schedule.mockRejectedValueOnce(
      Object.assign(new Error('private@example.invalid'), { databaseCode: '42883' }),
    );
    expect(await drainReviewSchedulingJobs({ client: client as never })).toEqual({
      processed: 0,
      failed: 1,
    });
    expect(rpc).toHaveBeenLastCalledWith(
      'finish_review_scheduling_job_v1',
      expect.objectContaining({ p_error_code: '42883' }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('private@');
  });
  it('does not acknowledge a failed booking read as success', async () => {
    const { client, rpc, maybeSingle } = fixture();
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '08006' } } as never);
    expect((await drainReviewSchedulingJobs({ client: client as never })).failed).toBe(1);
    expect(schedule).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith(
      'finish_review_scheduling_job_v1',
      expect.objectContaining({ p_error_code: 'scheduling_failed' }),
    );
  });
  it('does not schedule a booking that has since been cancelled', async () => {
    const { client } = fixture('cancelled');
    expect((await drainReviewSchedulingJobs({ client: client as never })).processed).toBe(1);
    expect(schedule).not.toHaveBeenCalled();
  });
  it('reports a lost claim rather than claiming completion', async () => {
    const { client, rpc } = fixture();
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await drainReviewSchedulingJobs({ client: client as never })).toEqual({
      processed: 0,
      failed: 1,
    });
  });
  it('surfaces claim failures to the cron response', async () => {
    const { client, rpc } = fixture();
    rpc.mockReset().mockResolvedValue({ data: null, error: { code: '08006' } });
    await expect(drainReviewSchedulingJobs({ client: client as never })).rejects.toThrow(
      'Failed to claim',
    );
  });
});
