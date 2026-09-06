import { beforeEach, describe, expect, it, vi } from 'vitest';
const upsert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: () => ({ from: () => ({ upsert }) }),
}));
vi.mock('@/server/observability', () => ({ recordObservabilityEvent: vi.fn() }));
vi.mock('@/server/queue/email-processing', () => ({ processEmailJobs: vi.fn() }));
import { scheduleEmailIntent } from '@/server/queue/email-intents';

describe('review email scheduling idempotency', () => {
  beforeEach(() => {
    upsert.mockResolvedValue({ error: null });
  });
  it('never overwrites an existing review intent during retry, including claimed and sent intents', async () => {
    await scheduleEmailIntent(
      {
        bookingId: 'booking-a',
        restaurantId: 'tenant-a',
        type: 'review_request',
        scheduledFor: '2026-09-06T14:00:00.000Z',
        reviewRequestId: 'journey-a',
        reviewStage: 'primary',
      },
      { jobId: 'review_request:primary:booking-a' },
    );
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ review_request_id: 'journey-a' }),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  });
  it('preserves rescheduling for non-review email intents', async () => {
    await scheduleEmailIntent({
      bookingId: 'booking-a',
      restaurantId: 'tenant-a',
      type: 'reminder_24h',
      scheduledFor: '2026-09-06T14:00:00.000Z',
    });
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ email_type: 'reminder_24h' }),
      { onConflict: 'dedupe_key', ignoreDuplicates: false },
    );
  });
});
