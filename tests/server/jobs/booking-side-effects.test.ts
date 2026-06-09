import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordBookingCreatedEventMock = vi.hoisted(() => vi.fn());
const sendFirstBookingConfirmationNotificationsMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendGuestBookingUpdateSmsMock = vi.hoisted(() => vi.fn());
const sendGuestBookingCancellationSmsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/analytics', () => ({
  recordBookingCancelledEvent: vi.fn(),
  recordBookingCreatedEvent: recordBookingCreatedEventMock,
}));

vi.mock('@/server/bookings/confirmation-notifications', () => ({
  sendFirstBookingConfirmationNotifications: sendFirstBookingConfirmationNotificationsMock,
}));

vi.mock('@/server/emails/bookings', () => ({
  sendBookingCancellationEmail: vi.fn(),
  sendBookingConfirmationEmail: sendBookingConfirmationEmailMock,
  sendBookingReminderEmail: vi.fn(),
  sendBookingReviewRequestEmail: vi.fn(),
  sendBookingUpdateEmail: vi.fn(),
  sendRestaurantCancellationEmail: vi.fn(),
}));

vi.mock('@/server/sms/bookings', () => ({
  sendGuestBookingCancellationSms: sendGuestBookingCancellationSmsMock,
  sendGuestBookingUpdateSms: sendGuestBookingUpdateSmsMock,
}));

vi.mock('@/server/runtime-policy', () => ({
  isEmailQueueEnabled: vi.fn(() => false),
}));

vi.mock('@/server/queue/email', () => ({
  enqueueEmailJob: vi.fn(),
}));

vi.mock('@/server/queue/email-intents', () => ({
  cancelEmailIntents: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

import {
  enqueueBookingCancelledSideEffects,
  enqueueBookingUpdatedSideEffects,
  processBookingCreatedSideEffects,
} from '@/server/jobs/booking-side-effects';

const pendingBooking = {
  id: 'booking-1',
  restaurant_id: 'rest-1',
  customer_id: 'customer-1',
  booking_date: '2026-04-12',
  start_time: '12:00:00',
  end_time: '13:30:00',
  booking_type: 'lunch',
  seating_preference: 'standard',
  status: 'pending',
  party_size: 2,
  customer_name: 'Guest Example',
  customer_email: 'guest@example.com',
  customer_phone: '+447700900000',
  notes: null,
  source: 'api',
  loyalty_points_awarded: 0,
  created_at: '2026-04-11T15:00:00.000Z',
  updated_at: '2026-04-11T15:00:00.000Z',
  reference: 'TESTREF',
} as const;

describe('processBookingCreatedSideEffects', () => {
  beforeEach(() => {
    recordBookingCreatedEventMock.mockReset();
    sendFirstBookingConfirmationNotificationsMock.mockReset();
    sendBookingConfirmationEmailMock.mockReset();
    sendGuestBookingUpdateSmsMock.mockReset();
    sendGuestBookingCancellationSmsMock.mockReset();
    recordBookingCreatedEventMock.mockResolvedValue(undefined);
    sendFirstBookingConfirmationNotificationsMock.mockResolvedValue({
      alreadySent: false,
      emailSent: true,
      smsSent: true,
    });
    sendBookingConfirmationEmailMock.mockResolvedValue({ id: 'email-log-1' });
    sendGuestBookingUpdateSmsMock.mockResolvedValue({ messageSid: 'SM123', status: 'sent' });
    sendGuestBookingCancellationSmsMock.mockResolvedValue({
      messageSid: 'SM124',
      status: 'sent',
    });
  });

  it('does not send a confirmed email when the booking is still pending', async () => {
    await processBookingCreatedSideEffects(
      {
        booking: pendingBooking,
        idempotencyKey: null,
        restaurantId: pendingBooking.restaurant_id,
        emailProvided: true,
      },
      {} as never,
    );

    expect(sendFirstBookingConfirmationNotificationsMock).not.toHaveBeenCalled();
    expect(sendBookingConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it('sends an update SMS for non-confirmation booking edits', async () => {
    const previous = {
      ...pendingBooking,
      status: 'confirmed',
      start_time: '19:00:00',
    };
    const current = {
      ...previous,
      start_time: '20:00:00',
      updated_at: '2026-04-11T15:10:00.000Z',
    };

    await enqueueBookingUpdatedSideEffects(
      {
        previous: previous as never,
        current: current as never,
        restaurantId: current.restaurant_id,
      },
      {} as never,
    );

    expect(sendGuestBookingUpdateSmsMock).toHaveBeenCalledWith(current);
  });

  it('sends a cancellation SMS for guest cancellations', async () => {
    const previous = {
      ...pendingBooking,
      status: 'confirmed',
    };
    const cancelled = {
      ...previous,
      status: 'cancelled',
      updated_at: '2026-04-11T15:20:00.000Z',
    };

    await enqueueBookingCancelledSideEffects(
      {
        previous: previous as never,
        cancelled: cancelled as never,
        restaurantId: cancelled.restaurant_id,
        cancelledBy: 'customer',
      },
      {} as never,
    );

    expect(sendGuestBookingCancellationSmsMock).toHaveBeenCalledWith(cancelled, {
      cancelledBy: 'customer',
    });
  });

  it('sends a cancellation SMS for restaurant-initiated cancellations', async () => {
    const previous = {
      ...pendingBooking,
      status: 'confirmed',
    };
    const cancelled = {
      ...previous,
      status: 'cancelled',
      updated_at: '2026-04-11T15:25:00.000Z',
    };

    await enqueueBookingCancelledSideEffects(
      {
        previous: previous as never,
        cancelled: cancelled as never,
        restaurantId: cancelled.restaurant_id,
        cancelledBy: 'staff',
      },
      {} as never,
    );

    expect(sendGuestBookingCancellationSmsMock).toHaveBeenCalledWith(cancelled, {
      cancelledBy: 'staff',
    });
  });
});
