import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
  sendBookingRejectedEmail: vi.fn(),
  sendBookingReminderEmail: vi.fn(),
  sendBookingReviewRequestEmail: vi.fn(),
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
}));

import { processEmailJob } from '@/server/queue/email-processing';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function mockBooking(row: Record<string, unknown> | null) {
  getServiceSupabaseClientMock.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: row, error: null })),
        })),
      })),
    })),
  });
}

describe('email job processing security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
