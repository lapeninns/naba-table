import { describe, expect, it, vi } from 'vitest';

import {
  accelerateReviewEmailFollowup,
  canSendReviewRequest,
  createReviewJourney,
  recordReviewRequestEvent,
} from '@/server/reviews/journeys';

describe('review journey service', () => {
  it('creates an atomic WhatsApp-first journey with channel eligibility', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        reviewRequestId: 'request-1',
        state: 'scheduled',
        primaryChannel: 'whatsapp',
        scheduledFor: '2026-09-05T10:00:00.000Z',
        followupScheduledFor: '2026-09-07T10:00:00.000Z',
        suppressionReason: null,
      },
      error: null,
    }));

    const result = await createReviewJourney(
      {
        bookingId: 'booking-1',
        emailEligible: true,
        restaurantId: 'restaurant-1',
        scheduledFor: '2026-09-05T10:00:00.000Z',
        whatsappEligible: true,
      },
      { rpc } as never,
    );

    expect(result.primaryChannel).toBe('whatsapp');
    expect(rpc).toHaveBeenCalledWith('schedule_review_request_v1', {
      p_booking_id: 'booking-1',
      p_campaign_key: 'review-growth-v1',
      p_email_eligible: true,
      p_experiment_arm: 'sequenced',
      p_restaurant_id: 'restaurant-1',
      p_scheduled_for: '2026-09-05T10:00:00.000Z',
      p_whatsapp_eligible: true,
    });
  });

  it('preserves the safe database error code without leaking provider details', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: {
        code: '42883',
        message: 'private@example.invalid',
        details: 'sensitive payload',
        hint: 'secret',
      },
    }));
    await expect(
      createReviewJourney(
        {
          bookingId: 'booking-1',
          restaurantId: 'restaurant-1',
          scheduledFor: '2026-09-06T10:00:00.000Z',
          emailEligible: true,
          whatsappEligible: false,
        },
        { rpc } as never,
      ),
    ).rejects.toMatchObject({
      message: 'Failed to create review journey (42883).',
      databaseCode: '42883',
    });
  });

  it('fails closed when a send is no longer allowed', async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));

    await expect(
      canSendReviewRequest(
        { channel: 'email', restaurantId: 'restaurant-1', reviewRequestId: 'request-1' },
        { rpc } as never,
      ),
    ).resolves.toBe(false);
  });

  it('records provider events with a stable idempotency key and no guest data', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await recordReviewRequestEvent(
      {
        channel: 'whatsapp',
        eventType: 'read',
        idempotencyKey: 'twilio:SM123:read',
        occurredAt: '2026-09-05T10:01:00.000Z',
        provider: 'twilio',
        providerEventId: 'SM123',
        restaurantId: 'restaurant-1',
        reviewRequestId: 'request-1',
      },
      { rpc } as never,
    );

    expect(rpc).toHaveBeenCalledWith(
      'record_review_request_event_v1',
      expect.objectContaining({
        p_idempotency_key: 'twilio:SM123:read',
        p_metadata: {},
      }),
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/guest|email|phone/i);
  });

  it('accelerates the email recovery path after WhatsApp fails', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await accelerateReviewEmailFollowup(
      { restaurantId: 'restaurant-1', reviewRequestId: 'request-1' },
      { rpc } as never,
    );

    expect(rpc).toHaveBeenCalledWith(
      'accelerate_review_email_followup_v1',
      expect.objectContaining({
        p_restaurant_id: 'restaurant-1',
        p_review_request_id: 'request-1',
      }),
    );
  });
});
