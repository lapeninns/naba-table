import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const sendBookingManageLinkEmailMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: vi.fn(),
  sendBookingManageLinkEmail: sendBookingManageLinkEmailMock,
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

import { processEmailJob } from '@/server/queue/email-processing';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';
const NOW = new Date('2026-09-26T12:00:00.000Z');

function mockBooking(row: Record<string, unknown>) {
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

function job(id = 'manage_link:booking:1') {
  return {
    id,
    payload: { bookingId: BOOKING_ID, restaurantId: RESTAURANT_ID, type: 'manage_link' as const },
  };
}

describe('manage_link email jobs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends to the stored booking (the job carries no address) with the job id as nonce', async () => {
    const row = {
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: 'stored@example.com',
      status: 'confirmed',
      start_at: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
      end_at: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
    };
    mockBooking(row);

    const result = await processEmailJob(job());

    expect(result).toEqual({ jobId: 'manage_link:booking:1', success: true });
    expect(sendBookingManageLinkEmailMock).toHaveBeenCalledWith(row, {
      nonce: 'manage_link:booking:1',
    });
  });

  it('skips a booking that has ended or was cancelled since the request', async () => {
    mockBooking({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: 'stored@example.com',
      status: 'confirmed',
      start_at: '2026-09-26T08:00:00.000Z',
      end_at: '2026-09-26T11:59:00.000Z',
    });
    expect(await processEmailJob(job())).toMatchObject({ skipped: true });

    mockBooking({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      customer_email: 'stored@example.com',
      status: 'cancelled',
      start_at: '2026-10-01T18:00:00.000Z',
      end_at: '2026-10-01T19:30:00.000Z',
    });
    expect(await processEmailJob(job())).toMatchObject({ skipped: true });
    expect(sendBookingManageLinkEmailMock).not.toHaveBeenCalled();
  });
});
