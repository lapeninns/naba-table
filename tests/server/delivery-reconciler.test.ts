import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', () => ({
  env: {
    twilio: {
      accountSid: null,
      apiKeySid: null,
      apiKeySecret: null,
      authToken: null,
    },
  },
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { reconcileDeliveryAnomalies } from '@/server/observability/delivery-reconciler';

function makeEmailInflightQuery() {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          in: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  };
}

function makeSmsInflightQuery() {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    message_sid: 'SM123',
                    recipient_phone: '447700900123',
                    restaurant_id: 'restaurant-1',
                    booking_id: 'booking-1',
                    sms_type: 'booking_confirmation',
                    occurred_at: '2026-05-09T08:00:00.000Z',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      })),
    })),
  };
}

function makeSmsTerminalQuery() {
  return {
    select: vi.fn(() => ({
      in: vi.fn(() => ({
        in: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  };
}

describe('reconcileDeliveryAnomalies SMS observability', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    recordObservabilityEventMock.mockReset();
    recordObservabilityEventMock.mockResolvedValue(undefined);

    let smsDeliveryLogCalls = 0;
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'email_delivery_log') return makeEmailInflightQuery();
        if (table === 'sms_delivery_log') {
          smsDeliveryLogCalls += 1;
          return smsDeliveryLogCalls === 1 ? makeSmsInflightQuery() : makeSmsTerminalQuery();
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });
  });

  it('redacts recipient phone numbers in stale SMS observability events', async () => {
    const report = await reconcileDeliveryAnomalies();

    expect(report.stuckSmsAttempts).toBe(1);
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'delivery.reconciler',
        eventType: 'sms.stuck_in_flight',
        context: expect.objectContaining({
          messageSid: 'SM123',
          recipientPhone: '********0123',
        }),
      }),
    );
  });
});
