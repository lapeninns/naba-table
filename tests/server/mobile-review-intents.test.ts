import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchBookingReviewWhatsAppMock = vi.hoisted(() => vi.fn());
const finalizeMobileWhatsAppAttemptMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const canSendReviewRequestMock = vi.hoisted(() => vi.fn());
const recordReviewRequestEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/notifications/booking-whatsapp-content', () => ({
  dispatchBookingReviewWhatsApp: dispatchBookingReviewWhatsAppMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/notifications/mobile', () => ({
  finalizeMobileWhatsAppAttempt: finalizeMobileWhatsAppAttemptMock,
}));

vi.mock('@/server/reviews/journeys', () => ({
  canSendReviewRequest: canSendReviewRequestMock,
  recordReviewRequestEvent: recordReviewRequestEventMock,
}));

import { drainMobileReviewIntents } from '@/server/queue/mobile-review-intents';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const BOOKING_ID = '22222222-2222-4222-8222-222222222222';

const claimedIntent = {
  id: '33333333-3333-4333-8333-333333333333',
  booking_id: BOOKING_ID,
  restaurant_id: RESTAURANT_ID,
  review_request_id: null,
  mobile_intent_attempts: 1,
  mobile_intent_attempt_error_code: null,
  mobile_intent_attempt_id: null,
  mobile_intent_attempt_status: null,
  mobile_intent_claim_token: '44444444-4444-4444-8444-444444444444',
  mobile_intent_status: 'claimed',
  mobile_intent_provider_message_id: null,
} as const;

function createClient(
  booking: Readonly<Record<string, unknown>> | null,
  intent: Readonly<Record<string, unknown>> = claimedIntent,
  finalizationOwned = true,
) {
  const updates: Array<Readonly<Record<string, unknown>>> = [];
  const updateFilters: Array<readonly [string, unknown]> = [];
  const client = {
    rpc: vi.fn().mockResolvedValue({ data: [intent], error: null }),
    from: vi.fn((table: string) => {
      if (table === 'bookings') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
              })),
            })),
          })),
        };
      }
      return {
        update: vi.fn((patch: Readonly<Record<string, unknown>>) => {
          updates.push(patch);
          return {
            eq: vi.fn((column1: string, value1: unknown) => {
              updateFilters.push([column1, value1]);
              return {
                eq: vi.fn((column2: string, value2: unknown) => {
                  updateFilters.push([column2, value2]);
                  return {
                    eq: vi.fn((column3: string, value3: unknown) => {
                      updateFilters.push([column3, value3]);
                      return {
                        eq: vi.fn((column4: string, value4: unknown) => {
                          updateFilters.push([column4, value4]);
                          return {
                            select: vi.fn(() => ({
                              maybeSingle: vi.fn().mockResolvedValue({
                                data: finalizationOwned ? { id: claimedIntent.id } : null,
                                error: null,
                              }),
                            })),
                          };
                        }),
                      };
                    }),
                  };
                }),
              };
            }),
          };
        }),
      };
    }),
  };
  getServiceSupabaseClientMock.mockReturnValue(client);
  return { client, updateFilters, updates };
}

describe('mobile review intent drain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchBookingReviewWhatsAppMock.mockResolvedValue({
      attemptId: '55555555-5555-4555-8555-555555555555',
      kind: 'whatsapp_accepted',
      providerMessageId: 'WA1',
      status: 'queued',
    });
    finalizeMobileWhatsAppAttemptMock.mockResolvedValue('queued');
    canSendReviewRequestMock.mockResolvedValue(true);
    recordReviewRequestEventMock.mockResolvedValue(true);
  });

  it('stops a claimed WhatsApp ask after the journey has converted', async () => {
    canSendReviewRequestMock.mockResolvedValue(false);
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      { ...claimedIntent, review_request_id: 'review-request-1' },
    );

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(dispatchBookingReviewWhatsAppMock).not.toHaveBeenCalled();
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_last_error: 'REVIEW_WHATSAPP_JOURNEY_STOPPED',
        mobile_intent_status: 'skipped',
      }),
    );
  });

  it('attributes an accepted WhatsApp send to its review journey', async () => {
    createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      { ...claimedIntent, review_request_id: 'review-request-1' },
    );

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(summary.sent).toBe(1);
    expect(recordReviewRequestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        eventType: 'sent',
        providerEventId: 'WA1',
        reviewRequestId: 'review-request-1',
      }),
      expect.anything(),
    );
  });

  it('claims due work and records a sent WhatsApp independently of email @contract', async () => {
    // Given
    const booking = {
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'completed',
    };
    const { client, updateFilters, updates } = createClient(booking);

    // When
    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    // Then
    expect(client.rpc).toHaveBeenCalledWith('claim_due_mobile_review_notifications', {
      p_limit: 20,
    });
    expect(dispatchBookingReviewWhatsAppMock).toHaveBeenCalledWith(booking, RESTAURANT_ID);
    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(updates).toContainEqual(expect.objectContaining({ mobile_intent_status: 'processed' }));
    expect(updateFilters).toContainEqual([
      'mobile_intent_claim_token',
      claimedIntent.mobile_intent_claim_token,
    ]);
    expect(updateFilters).toContainEqual(['restaurant_id', RESTAURANT_ID]);
  });

  it('records stale or ineligible work as skipped without dispatch @contract', async () => {
    // Given
    const { updates } = createClient(null);

    // When
    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    // Then
    expect(dispatchBookingReviewWhatsAppMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(updates).toContainEqual(expect.objectContaining({ mobile_intent_status: 'skipped' }));
  });

  it('returns infrastructure failures to pending before the final retry @contract', async () => {
    // Given
    dispatchBookingReviewWhatsAppMock.mockRejectedValue(new Error('short-link unavailable'));
    const { updates } = createClient({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'completed',
    });

    // When
    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    // Then
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_status: 'pending',
        mobile_intent_last_error: 'REVIEW_WHATSAPP_INFRASTRUCTURE_FAILURE',
      }),
    );
  });

  it('records infrastructure failure as terminal after the final retry @contract', async () => {
    // Given
    dispatchBookingReviewWhatsAppMock.mockRejectedValue(new Error('mobile ledger unavailable'));
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      { ...claimedIntent, mobile_intent_attempts: 3 },
    );

    // When
    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    // Then
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(expect.objectContaining({ mobile_intent_status: 'failed' }));
  });

  it('marks an already-claimed one-shot provider outcome as skipped @contract', async () => {
    // Given
    dispatchBookingReviewWhatsAppMock.mockResolvedValue({ kind: 'duplicate' });
    const { updates } = createClient({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'completed',
    });

    // When
    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    // Then
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 1, failed: 0 });
    expect(updates).toContainEqual(expect.objectContaining({ mobile_intent_status: 'skipped' }));
  });

  it('records a provider-attempt failure as terminal without retrying the intent @contract', async () => {
    dispatchBookingReviewWhatsAppMock.mockResolvedValue({
      attemptId: '55555555-5555-4555-8555-555555555555',
      kind: 'provider_attempt_failed',
    });
    const { updates } = createClient({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'completed',
    });

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_last_error: 'REVIEW_WHATSAPP_PROVIDER_ATTEMPT_FAILED',
        mobile_intent_status: 'failed',
      }),
    );
  });

  it('durably schedules provider acceptance finalization without another provider send @contract', async () => {
    dispatchBookingReviewWhatsAppMock.mockResolvedValue({
      attemptId: '55555555-5555-4555-8555-555555555555',
      errorCode: null,
      kind: 'attempt_finalization_pending',
      providerMessageId: 'WA-known',
      status: 'queued',
    });
    const { updates } = createClient({
      id: BOOKING_ID,
      restaurant_id: RESTAURANT_ID,
      status: 'completed',
    });

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_attempt_id: '55555555-5555-4555-8555-555555555555',
        mobile_intent_attempt_status: 'queued',
        mobile_intent_provider_message_id: 'WA-known',
        mobile_intent_last_error: 'REVIEW_WHATSAPP_ATTEMPT_FINALIZATION_PENDING',
        mobile_intent_status: 'pending',
      }),
    );
  });

  it('retries only known provider-attempt finalization without resending WhatsApp @contract', async () => {
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      {
        ...claimedIntent,
        mobile_intent_attempt_id: '55555555-5555-4555-8555-555555555555',
        mobile_intent_attempt_status: 'queued',
        mobile_intent_provider_message_id: 'WA-known',
      },
    );
    finalizeMobileWhatsAppAttemptMock.mockResolvedValueOnce('delivered');

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(dispatchBookingReviewWhatsAppMock).not.toHaveBeenCalled();
    expect(finalizeMobileWhatsAppAttemptMock).toHaveBeenCalledWith({
      attemptId: '55555555-5555-4555-8555-555555555555',
      errorCode: null,
      providerMessageId: 'WA-known',
      status: 'queued',
    });
    expect(summary).toEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 });
    expect(updates).toContainEqual(expect.objectContaining({ mobile_intent_status: 'processed' }));
  });

  it('retries pre-accept failure finalization without resending WhatsApp @contract', async () => {
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      {
        ...claimedIntent,
        mobile_intent_attempt_error_code: 'Error',
        mobile_intent_attempt_id: '55555555-5555-4555-8555-555555555555',
        mobile_intent_attempt_status: 'failed',
      },
    );
    finalizeMobileWhatsAppAttemptMock.mockResolvedValueOnce('failed');

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(dispatchBookingReviewWhatsAppMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_last_error: 'REVIEW_WHATSAPP_PROVIDER_ATTEMPT_FAILED',
        mobile_intent_status: 'failed',
      }),
    );
  });

  it('keeps a failed finalization retry pending without resending WhatsApp @contract', async () => {
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      {
        ...claimedIntent,
        mobile_intent_attempt_id: '55555555-5555-4555-8555-555555555555',
        mobile_intent_attempt_status: 'queued',
        mobile_intent_provider_message_id: 'WA-known',
      },
    );
    finalizeMobileWhatsAppAttemptMock.mockRejectedValueOnce(new Error('database unavailable'));

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(dispatchBookingReviewWhatsAppMock).not.toHaveBeenCalled();
    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toContainEqual(
      expect.objectContaining({
        mobile_intent_last_error: 'REVIEW_WHATSAPP_INFRASTRUCTURE_FAILURE',
        mobile_intent_status: 'pending',
      }),
    );
  });

  it('does not overwrite a newer claim when finalization ownership is lost @contract', async () => {
    dispatchBookingReviewWhatsAppMock.mockResolvedValue({
      attemptId: '55555555-5555-4555-8555-555555555555',
      kind: 'whatsapp_accepted',
      providerMessageId: 'WA1',
      status: 'queued',
    });
    const { updates } = createClient(
      { id: BOOKING_ID, restaurant_id: RESTAURANT_ID, status: 'completed' },
      claimedIntent,
      false,
    );

    const summary = await drainMobileReviewIntents({ maxJobs: 20 });

    expect(summary).toEqual({ processed: 1, sent: 0, skipped: 0, failed: 1 });
    expect(updates).toHaveLength(1);
  });
});
