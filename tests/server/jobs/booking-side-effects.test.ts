import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordBookingCreatedEventMock = vi.hoisted(() => vi.fn());
const sendFirstBookingConfirmationNotificationsMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendGuestBookingUpdateSmsMock = vi.hoisted(() => vi.fn());
const sendGuestBookingCancellationSmsMock = vi.hoisted(() => vi.fn());
const enqueueEmailJobMock = vi.hoisted(() => vi.fn());
const emailQueueEnabled = vi.hoisted(() => ({ value: false }));

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
  isEmailQueueEnabled: vi.fn(() => emailQueueEnabled.value),
}));

vi.mock('@/server/queue/email', () => ({
  enqueueEmailJob: enqueueEmailJobMock,
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
  enqueueCheckOutSideEffects,
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
    enqueueEmailJobMock.mockReset();
    emailQueueEnabled.value = false;
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
    enqueueEmailJobMock.mockResolvedValue(undefined);
  });

  it('durably schedules a completed review job without a valid guest email @contract', async () => {
    // Given
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      customer_email: 'invalid-email',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const scheduleReviewIntentMock = vi.fn().mockResolvedValue({
      data: completed.id,
      error: null,
    });
    const client = {
      rpc: scheduleReviewIntentMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_send_review_request: true,
                google_review_url: 'https://g.page/r/example/review',
                timezone: 'Europe/London',
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    // When
    await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
      supabase: client as never,
    });

    // Then
    expect(scheduleReviewIntentMock).toHaveBeenCalledWith(
      'schedule_mobile_review_notification',
      expect.objectContaining({
        p_booking_id: completed.id,
        p_recipient_phone: completed.customer_phone,
        p_restaurant_id: completed.restaurant_id,
      }),
    );
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('schedules neither review channel when the venue preference is disabled @contract', async () => {
    // Given
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email_send_review_request: false, timezone: 'Europe/London' },
              error: null,
            }),
          })),
        })),
      })),
    };

    // When
    await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
      supabase: client as never,
    });

    // Then
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('does not schedule mobile review without a valid venue review destination @contract', async () => {
    const completed = {
      ...pendingBooking,
      status: 'completed',
      customer_email: 'invalid-email',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const scheduleReviewIntentMock = vi.fn();
    const client = {
      rpc: scheduleReviewIntentMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_send_review_request: true,
                google_review_url: null,
                timezone: 'Europe/London',
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
      supabase: client as never,
    });

    expect(scheduleReviewIntentMock).not.toHaveBeenCalled();
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('does not schedule a phone-only review for version 1 consent @contract', async () => {
    // Given
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      customer_email: 'invalid-email',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-transactional-v1',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email_send_review_request: true, timezone: 'Europe/London' },
              error: null,
            }),
          })),
        })),
      })),
    };

    // When
    await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
      supabase: client as never,
    });

    // Then
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('schedules mobile but not email when a completed booking has an invalid guest email @contract', async () => {
    // Given
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      customer_email: 'invalid-email',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const scheduleReviewIntentMock = vi.fn().mockResolvedValue({
      data: completed.id,
      error: null,
    });
    const client = {
      rpc: scheduleReviewIntentMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_send_review_request: true,
                google_review_url: 'https://g.page/r/example/review',
                timezone: 'Europe/London',
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    // When
    await processBookingCreatedSideEffects(
      {
        booking: completed,
        idempotencyKey: null,
        restaurantId: completed.restaurant_id,
        emailProvided: true,
      },
      client as never,
    );

    // Then
    expect(scheduleReviewIntentMock).toHaveBeenCalledOnce();
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('schedules mobile review once on a transition to completed @contract', async () => {
    // Given
    emailQueueEnabled.value = true;
    const previous = { ...pendingBooking, status: 'confirmed' };
    const completed = {
      ...previous,
      status: 'completed',
      customer_email: 'invalid-email',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T18:00:00.000Z',
    };
    const scheduleReviewIntentMock = vi.fn().mockResolvedValue({
      data: completed.id,
      error: null,
    });
    const client = {
      rpc: scheduleReviewIntentMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                email_send_review_request: true,
                google_review_url: 'https://g.page/r/example/review',
                timezone: 'Europe/London',
              },
              error: null,
            }),
          })),
        })),
      })),
    };

    // When
    await enqueueBookingUpdatedSideEffects(
      {
        previous: previous as never,
        current: completed as never,
        restaurantId: completed.restaurant_id,
      },
      { supabase: client as never },
    );

    // Then
    expect(scheduleReviewIntentMock).toHaveBeenCalledOnce();
    expect(enqueueEmailJobMock).not.toHaveBeenCalled();
  });

  it('does not send a confirmed email when the booking is still pending', async () => {
    await processBookingCreatedSideEffects(
      {
        booking: pendingBooking,
        idempotencyKey: null,
        restaurantId: pendingBooking.restaurant_id,
        emailProvided: true,
      },
      {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { email_send_review_request: true },
                error: null,
              }),
            })),
          })),
        })),
      } as never,
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
