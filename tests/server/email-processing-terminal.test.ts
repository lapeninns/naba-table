import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  isBookingEmailSkippedError: () => false,
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
  sendBookingRejectedEmail: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendBookingReviewRequestEmail: vi.fn(),
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
}));

vi.mock('@/server/reviews/journeys', () => ({
  canSendReviewRequest: vi.fn(),
  recordReviewRequestEvent: vi.fn(),
}));

import { ResendSendError } from '@/libs/resend';
import { processEmailJob } from '@/server/queue/email-processing';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function mockBookingLookup(result: { data: unknown; error: unknown }) {
  getServiceSupabaseClientMock.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => result) })),
      })),
    })),
  });
}

const confirmedBooking = {
  id: 'booking-1',
  restaurant_id: RESTAURANT_ID,
  customer_email: 'guest@example.com',
  status: 'confirmed',
};

const job = {
  id: 'job-1',
  payload: { bookingId: 'booking-1', restaurantId: RESTAURANT_ID, type: 'confirmation' as const },
};

describe('email job failure classification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries when the booking lookup itself fails (transient)', async () => {
    mockBookingLookup({ data: null, error: { message: 'connection reset' } });

    const result = await processEmailJob(job);

    expect(result).toMatchObject({ success: false, error: 'BOOKING_LOOKUP_FAILED' });
    expect(result.terminal).not.toBe(true);
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it('treats a missing booking as terminal (skipped, never retried)', async () => {
    mockBookingLookup({ data: null, error: null });

    await expect(processEmailJob(job)).resolves.toEqual({
      jobId: 'job-1',
      success: true,
      skipped: true,
    });
  });

  // Suppressed and provider-rejected recipients are covered through the real dispatch in
  // email-processing-real-dispatch.test.ts.

  it('keeps provider outages and rate limits retryable', async () => {
    mockBookingLookup({ data: confirmedBooking, error: null });
    sendBookingConfirmationEmailMock.mockRejectedValue(
      new ResendSendError({
        name: 'rate_limit_exceeded',
        message: 'Too many requests.',
        statusCode: 429,
      }),
    );

    await expect(processEmailJob(job)).resolves.toEqual({
      jobId: 'job-1',
      success: false,
      error: 'EMAIL_JOB_FAILED',
    });
  });
});
