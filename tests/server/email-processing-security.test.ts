import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendBookingReviewRequestEmailMock = vi.hoisted(() => vi.fn());
const canSendReviewRequestMock = vi.hoisted(() => vi.fn());
const recordReviewRequestEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
  sendBookingRejectedEmail: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendBookingReviewRequestEmail: sendBookingReviewRequestEmailMock,
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
}));

vi.mock('@/server/reviews/journeys', () => ({
  canSendReviewRequest: canSendReviewRequestMock,
  recordReviewRequestEvent: recordReviewRequestEventMock,
}));

import { processEmailJob } from '@/server/queue/email-processing';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function mockBooking(row: Record<string, unknown> | null) {
  const updateEq = vi.fn(async () => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  getServiceSupabaseClientMock.mockReturnValue({
    from: vi.fn((table: string) =>
      table === 'bookings'
        ? {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: row, error: null })),
              })),
            })),
          }
        : { update },
    ),
  });
}

describe('email job processing security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canSendReviewRequestMock.mockResolvedValue(true);
    recordReviewRequestEventMock.mockResolvedValue(true);
    sendBookingReviewRequestEmailMock.mockResolvedValue({
      id: 'delivery-1',
      messageId: 'message-1',
    });
  });

  it('stops a queued review follow-up after the journey has already converted', async () => {
    canSendReviewRequestMock.mockResolvedValue(false);
    mockBooking({
      id: 'booking-1',
      restaurant_id: RESTAURANT_A,
      customer_email: 'guest@example.com',
      status: 'completed',
      end_at: '2026-09-03T20:00:00.000Z',
    });

    const result = await processEmailJob({
      id: 'review-followup',
      payload: {
        bookingId: 'booking-1',
        restaurantId: RESTAURANT_A,
        reviewRequestId: 'review-request-1',
        reviewStage: 'followup',
        type: 'review_request',
      },
    });

    expect(result).toEqual({ jobId: 'review-followup', success: true, skipped: true });
    expect(sendBookingReviewRequestEmailMock).not.toHaveBeenCalled();
  });

  it('attributes a permitted review email send to its journey', async () => {
    mockBooking({
      id: 'booking-1',
      restaurant_id: RESTAURANT_A,
      customer_email: 'guest@example.com',
      status: 'completed',
      end_at: new Date().toISOString(),
    });

    const result = await processEmailJob({
      id: 'review-primary',
      payload: {
        bookingId: 'booking-1',
        restaurantId: RESTAURANT_A,
        reviewRequestId: 'review-request-1',
        reviewStage: 'primary',
        type: 'review_request',
      },
    });

    expect(result.success).toBe(true);
    expect(recordReviewRequestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        eventType: 'sent',
        idempotencyKey: 'review:review-request-1:email:primary:sent',
        providerEventId: 'message-1',
      }),
      expect.anything(),
    );
  });

  it('skips forged jobs when payload restaurantId does not match the current booking', async () => {
    mockBooking({
      id: 'booking-1',
      restaurant_id: RESTAURANT_A,
      customer_email: 'guest@example.com',
      status: 'confirmed',
    });

    const result = await processEmailJob({
      id: 'forged-job',
      payload: {
        bookingId: 'booking-1',
        restaurantId: RESTAURANT_B,
        type: 'confirmation',
      },
    });

    expect(result).toEqual({ jobId: 'forged-job', success: true, skipped: true });
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it('dispatches only when the job tenant matches the booking tenant', async () => {
    mockBooking({
      id: 'booking-1',
      restaurant_id: RESTAURANT_A,
      customer_email: 'guest@example.com',
      status: 'confirmed',
    });

    const result = await processEmailJob({
      id: 'valid-job',
      payload: {
        bookingId: 'booking-1',
        restaurantId: RESTAURANT_A,
        type: 'confirmation',
      },
    });

    expect(result).toEqual({ jobId: 'valid-job', success: true });
    expect(sendBookingConfirmationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1', restaurant_id: RESTAURANT_A }),
    );
  });
});
