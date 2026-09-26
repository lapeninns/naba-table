import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const sendBookingModificationPendingEmailMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
  sendBookingManageLinkEmail: vi.fn(),
  sendBookingModificationPendingEmail: sendBookingModificationPendingEmailMock,
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

import { EMAIL_JOB_TYPE_VALUES } from '@/server/queue/email-contract';
import { processEmailJob } from '@/server/queue/email-processing';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '65c3207e-318a-4e4b-b82d-1249a720d776';

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

function job(id = 'email__modification_pending__booking__abc') {
  return {
    id,
    payload: {
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      type: 'modification_pending' as const,
    },
  };
}

function booking(status: string) {
  return {
    id: BOOKING_ID,
    restaurant_id: RESTAURANT_ID,
    customer_email: 'stored@example.com',
    status,
  };
}

describe('modification_pending email jobs', () => {
  beforeEach(() => {
    sendBookingModificationPendingEmailMock.mockReset();
    sendBookingConfirmationEmailMock.mockReset();
  });

  it('is a known email job type', () => {
    expect(EMAIL_JOB_TYPE_VALUES).toContain('modification_pending');
  });

  it.each(['pending', 'pending_allocation'])(
    'sends the modification-pending template (not the new-request copy) for a %s booking',
    async (status) => {
      const row = booking(status);
      mockBooking(row);

      const result = await processEmailJob(job());

      expect(result).toEqual({ jobId: job().id, success: true });
      expect(sendBookingModificationPendingEmailMock).toHaveBeenCalledWith(row, {
        reportSkips: true,
      });
      expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
    },
  );

  it.each(['confirmed', 'cancelled', 'checked_in'])(
    'skips a booking that is %s by the time the job runs',
    async (status) => {
      mockBooking(booking(status));

      expect(await processEmailJob(job())).toMatchObject({ success: true, skipped: true });
      expect(sendBookingModificationPendingEmailMock).not.toHaveBeenCalled();
    },
  );
});
