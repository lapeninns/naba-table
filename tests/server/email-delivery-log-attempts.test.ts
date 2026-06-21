import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { listEmailDeliveryAttemptsForRestaurant } from '@/server/emails/email-delivery-log';

describe('email delivery attempts feed', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
    recordObservabilityEventMock.mockReset();
  });

  it('maps the current delivery-log row id from the RPC feed', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          messageId: 'provider-message-id',
          recipientEmail: 'guest@example.com',
          bookingId: null,
          emailType: 'created',
          templateType: 'booking_confirmation',
          provider: 'resend',
          currentStatus: 'failed',
          currentOccurredAt: '2026-05-16T10:00:00.000Z',
          events: [],
          booking: null,
        },
      ],
      error: null,
    });
    getServiceSupabaseClientMock.mockReturnValue({ rpc });

    const result = await listEmailDeliveryAttemptsForRestaurant({
      restaurantId: '22222222-2222-4222-8222-222222222222',
      range: '7d',
      page: 1,
      pageSize: 25,
    });

    expect(result.attempts[0]?.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.attempts[0]?.messageId).toBe('provider-message-id');
  });

  it('falls back to the direct query when the feed RPC has an ambiguous id error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42702',
        message: 'column reference "id" is ambiguous',
      },
    });
    const fallbackQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const from = vi.fn().mockReturnValue(fallbackQuery);
    getServiceSupabaseClientMock.mockReturnValue({ from, rpc });

    const result = await listEmailDeliveryAttemptsForRestaurant({
      restaurantId: '22222222-2222-4222-8222-222222222222',
      range: '7d',
      page: 1,
      pageSize: 25,
    });

    expect(result).toMatchObject({
      attempts: [],
      hasNext: false,
      page: 1,
      pageSize: 25,
    });
    expect(from).toHaveBeenCalledWith('email_delivery_log');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'attempts_feed_rpc_fallback',
        context: expect.objectContaining({ errorCode: '42702' }),
      }),
    );
  });

  it('keeps the RPC migration returning the retryable current event id', () => {
    const migration = readFileSync(
      'supabase/migrations/20260516115600_expose_email_delivery_attempt_retry_id.sql',
      'utf8',
    );

    expect(migration).toContain('"id" uuid');
    expect(migration).toContain('l.id AS current_id');
    expect(migration).toContain('f.current_id AS "id"');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_feed',
    );
    expect(migration).toContain('TO service_role');
  });

  it('keeps the current RPC migration qualified against the PL/pgSQL id output column', () => {
    const migration = readFileSync(
      'supabase/migrations/20260519115100_fix_email_delivery_attempts_feed_ambiguous_id.sql',
      'utf8',
    );

    expect(migration).toContain('l.id AS current_id');
    expect(migration).toContain('f.current_id AS "id"');
    expect(migration).toContain('SELECT bf.id FROM booking_filter bf');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.ops_email_delivery_attempts_feed',
    );
  });
});
