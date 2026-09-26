import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ from: () => ({ upsert }) }),
}));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/queue/email-processing', () => ({ processEmailJobs: vi.fn() }));

import { scheduleEmailIntent } from '@/server/queue/email-intents';

describe('manage-link email scheduling idempotency', () => {
  beforeEach(() => {
    upsert.mockClear();
    upsert.mockResolvedValue({ error: null });
  });

  it('never resets an existing manage_link intent in the same throttle bucket', async () => {
    // A repeated lookup inside one 15-minute bucket must not flip a claimed or sent intent
    // back to pending, which would send the guest a second link.
    await scheduleEmailIntent(
      { bookingId: 'booking-a', restaurantId: 'tenant-a', type: 'manage_link' },
      { jobId: 'manage_link:booking-a:1234' },
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dedupe_key: 'manage_link__booking-a__1234',
        email_type: 'manage_link',
        status: 'pending',
      }),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  });
});
