import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordReviewRequestEventMock = vi.hoisted(() => vi.fn());
const accelerateReviewEmailFollowupMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/sms/bookings', () => ({
  sendClaimedBookingSmsFallback: vi.fn(),
}));

vi.mock('@/server/reviews/journeys', () => ({
  accelerateReviewEmailFollowup: accelerateReviewEmailFollowupMock,
  recordReviewRequestEvent: recordReviewRequestEventMock,
}));

import { processWhatsAppStatusCallback } from '@/server/notifications/whatsapp-status';

describe('processWhatsAppStatusCallback', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    recordReviewRequestEventMock.mockReset();
    recordReviewRequestEventMock.mockResolvedValue(true);
    accelerateReviewEmailFollowupMock.mockResolvedValue(true);
  });

  it('finalizes a signed callback without the PostgREST mutation OR failure @worker', async () => {
    // Given: a claimed WhatsApp attempt and a PostgREST mutation builder that
    // reproduces the production `.or()` column-resolution failure.
    const attemptQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          notification_id: '44444444-4444-4444-8444-444444444444',
          recipient_phone: '+447700900001',
          status: 'queued',
        },
        error: null,
      }),
      or: vi.fn(),
      select: vi.fn(),
    };
    attemptQuery.eq.mockReturnValue(attemptQuery);
    attemptQuery.or.mockReturnValue(attemptQuery);
    attemptQuery.select.mockReturnValue(attemptQuery);

    const notificationQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: {
          notification_type: 'booking_review_request',
          recipient_phone: '+447700900001',
          restaurant_id: '55555555-5555-4555-8555-555555555555',
          review_request_id: '66666666-6666-4666-8666-666666666666',
        },
        error: null,
      }),
    };
    notificationQuery.eq.mockReturnValue(notificationQuery);
    notificationQuery.select.mockReturnValue(notificationQuery);

    const updateQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      or: vi.fn(() => {
        throw new Error('column mobile_notification_attempts.provider_message_id does not exist');
      }),
      select: vi.fn(),
      update: vi.fn(),
    };
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.update.mockReturnValue(updateQuery);

    const rpc = vi.fn().mockResolvedValue({ data: 'delivered', error: null });
    let attemptTableCalls = 0;
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'mobile_notifications') return notificationQuery;
        attemptTableCalls += 1;
        return attemptTableCalls === 1 ? attemptQuery : updateQuery;
      }),
      rpc,
    });

    // When: Twilio advances the attempt to delivered.
    const result = processWhatsAppStatusCallback({
      attemptId: '33333333-3333-4333-8333-333333333333',
      errorCode: null,
      messageSid: 'MM123',
      providerStatus: 'delivered',
      recipientPhone: 'whatsapp:+447700900001',
    });

    // Then: the database-owned finalizer applies the transition without a
    // mutation `.or()` filter.
    await expect(result).resolves.toEqual({ fallbackSent: false, ignored: false });
    expect(rpc).toHaveBeenCalledWith('finalize_mobile_whatsapp_attempt', {
      p_attempt_id: '33333333-3333-4333-8333-333333333333',
      p_error_code: null,
      p_provider_message_id: 'MM123',
      p_status: 'delivered',
    });
    expect(updateQuery.or).not.toHaveBeenCalled();
    expect(recordReviewRequestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        eventType: 'delivered',
        providerEventId: 'MM123',
        reviewRequestId: '66666666-6666-4666-8666-666666666666',
      }),
      expect.anything(),
    );
  });
});
