import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recordBookingCreatedEventMock = vi.hoisted(() => vi.fn());
const sendFirstBookingConfirmationNotificationsMock = vi.hoisted(() => vi.fn());
const sendBookingConfirmationEmailMock = vi.hoisted(() => vi.fn());
const sendGuestBookingUpdateSmsMock = vi.hoisted(() => vi.fn());
const sendGuestBookingCancellationSmsMock = vi.hoisted(() => vi.fn());
const enqueueEmailJobMock = vi.hoisted(() => vi.fn());
const cancelEmailIntentsMock = vi.hoisted(() => vi.fn());
const emailQueueEnabled = vi.hoisted(() => ({ value: false }));
const createReviewJourneyMock = vi.hoisted(() =>
  vi.fn(
    async (input: { emailEligible: boolean; scheduledFor: string; whatsappEligible: boolean }) => ({
      reviewRequestId: 'review-request-1',
      state: 'scheduled',
      primaryChannel: input.whatsappEligible ? 'whatsapp' : input.emailEligible ? 'email' : null,
      scheduledFor: input.scheduledFor,
      followupScheduledFor:
        input.whatsappEligible && input.emailEligible
          ? new Date(new Date(input.scheduledFor).getTime() + 48 * 60 * 60 * 1000).toISOString()
          : null,
      suppressionReason: null,
    }),
  ),
);

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
  cancelEmailIntents: cancelEmailIntentsMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: vi.fn(),
}));

vi.mock('@/server/reviews/journeys', () => ({
  createReviewJourney: createReviewJourneyMock,
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

afterEach(() => {
  vi.useRealTimers();
});

describe('processBookingCreatedSideEffects', () => {
  beforeEach(() => {
    recordBookingCreatedEventMock.mockReset();
    sendFirstBookingConfirmationNotificationsMock.mockReset();
    sendBookingConfirmationEmailMock.mockReset();
    sendGuestBookingUpdateSmsMock.mockReset();
    sendGuestBookingCancellationSmsMock.mockReset();
    enqueueEmailJobMock.mockReset();
    cancelEmailIntentsMock.mockReset();
    createReviewJourneyMock.mockClear();
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
    cancelEmailIntentsMock.mockResolvedValue(0);
  });

  it.each(['journey', 'email', 'preference'])(
    'keeps strict review scheduling retryable after %s failure',
    async (stage) => {
      emailQueueEnabled.value = true;
      const client = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { email_send_review_request: true, timezone: 'Europe/London' },
                error: stage === 'preference' ? { code: '08006' } : null,
              }),
            })),
          })),
        })),
      };
      if (stage === 'journey')
        createReviewJourneyMock.mockRejectedValueOnce(new Error('scheduler unavailable'));
      if (stage === 'email')
        enqueueEmailJobMock.mockRejectedValueOnce(new Error('queue unavailable'));
      await expect(
        enqueueCheckOutSideEffects(
          { ...pendingBooking, status: 'completed', end_at: '2026-09-06T10:00:00.000Z' } as never,
          'rest-1',
          { supabase: client as never, retryOnFailure: true },
        ),
      ).rejects.toThrow();
    },
  );

  it('retains a failed WhatsApp enqueue for retry and preserves the existing journey time', async () => {
    emailQueueEnabled.value = true;
    const originalTime = '2026-09-05T10:00:00.000Z';
    createReviewJourneyMock.mockResolvedValueOnce({
      reviewRequestId: 'review-request-1',
      state: 'scheduled',
      primaryChannel: 'whatsapp',
      scheduledFor: originalTime,
      followupScheduledFor: null,
      suppressionReason: null,
    });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '08006' } });
    const client = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({
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
    await expect(
      enqueueCheckOutSideEffects(
        {
          ...pendingBooking,
          status: 'completed',
          customer_email: 'invalid',
          end_at: '2026-09-05T07:00:00.000Z',
          whatsapp_consent_actor_id: null,
          whatsapp_opt_in: true,
          whatsapp_consent_version: 'booking-plus-review-v2',
          whatsapp_consent_source: 'guest_reserve',
          whatsapp_consent_phone: pendingBooking.customer_phone,
        } as never,
        'rest-1',
        { supabase: client as never, retryOnFailure: true },
      ),
    ).rejects.toThrow('Failed to schedule mobile');
    expect(rpc).toHaveBeenCalledWith(
      'schedule_mobile_review_notification',
      expect.objectContaining({ p_scheduled_for: originalTime }),
    );
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

  it('defers a commute-window review send to the 7 PM evening peak @contract', async () => {
    // Given: visit ends 14:00 London; +3h review delay proposes 17:00 London (commute).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-07-12T13:30:00.000Z');
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      end_at: '2026-07-12T13:00:00.000Z',
    };
    const client = {
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

    // Then: pushed from 17:00 to 19:00 London (18:00Z), minutes preserved.
    expect(enqueueEmailJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: completed.id,
        type: 'review_request',
        scheduledFor: '2026-07-12T18:00:00.000Z',
      }),
      expect.objectContaining({ jobId: `review_request:primary:${completed.id}` }),
    );
  });

  it('keeps evening-peak review sends at their proposed time @contract', async () => {
    // Given: visit ends 16:30 London; +3h proposes 19:30 London — already past the commute.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-07-12T16:00:00.000Z');
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      end_at: '2026-07-12T15:30:00.000Z',
    };
    const client = {
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

    // Then: unchanged — 19:30 London is 18:30Z.
    expect(enqueueEmailJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'review_request',
        scheduledFor: '2026-07-12T18:30:00.000Z',
      }),
      expect.objectContaining({ jobId: `review_request:primary:${completed.id}` }),
    );
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

  it('sequences email 48 hours after WhatsApp when both review channels are eligible @contract', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-07-12T16:00:00.000Z');
    emailQueueEnabled.value = true;
    const completed = {
      ...pendingBooking,
      status: 'completed',
      whatsapp_consent_actor_id: null,
      whatsapp_consent_phone: pendingBooking.customer_phone,
      whatsapp_consent_source: 'guest_reserve',
      whatsapp_consent_version: 'booking-plus-review-v2',
      whatsapp_opt_in: true,
      end_at: '2026-07-12T15:30:00.000Z',
    };
    const updateQuery = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: completed.id, error: null }),
      from: vi.fn((table: string) =>
        table === 'restaurants'
          ? {
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
            }
          : { update: vi.fn(() => updateQuery) },
      ),
    };

    await enqueueCheckOutSideEffects(completed as never, completed.restaurant_id, {
      supabase: client as never,
    });

    expect(enqueueEmailJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewRequestId: 'review-request-1',
        reviewStage: 'followup',
        scheduledFor: '2026-07-14T18:30:00.000Z',
        type: 'review_request',
      }),
      expect.objectContaining({ jobId: `review_request:followup:${completed.id}` }),
    );
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

  it('replaces reminder intents when a confirmed booking start changes @contract', async () => {
    // Given
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-07-17T11:19:40.000Z');
    emailQueueEnabled.value = true;
    const previous = {
      ...pendingBooking,
      status: 'confirmed',
      booking_date: '2026-07-17',
      start_at: '2026-07-17T19:00:00.000Z',
      end_at: '2026-07-17T20:15:00.000Z',
    };
    const current = {
      ...previous,
      booking_date: '2026-07-22',
      start_at: '2026-07-22T19:00:00.000Z',
      end_at: '2026-07-22T20:15:00.000Z',
      updated_at: '2026-07-17T11:19:40.000Z',
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
    await enqueueBookingUpdatedSideEffects(
      {
        previous: previous as never,
        current: current as never,
        restaurantId: current.restaurant_id,
      },
      { skipEmail: true, supabase: client as never },
    );

    // Then
    expect(cancelEmailIntentsMock).toHaveBeenCalledWith({
      bookingId: current.id,
      types: ['reminder_24h', 'reminder_short'],
    });
    expect(enqueueEmailJobMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bookingId: current.id,
        type: 'reminder_24h',
        scheduledFor: expect.stringContaining('2026-07-21'),
      }),
      expect.objectContaining({ jobId: `reminder_24h:${current.id}` }),
    );
    expect(enqueueEmailJobMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        bookingId: current.id,
        type: 'reminder_short',
        scheduledFor: expect.stringContaining('2026-07-22'),
      }),
      expect.objectContaining({ jobId: `reminder_short:${current.id}` }),
    );
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
