import { beforeEach, describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { processSmsStatusCallback } from '@/server/notifications/sms-status';

function createAttemptQuery(result: {
  readonly data: { readonly id: string; readonly recipient_phone: string } | null;
  readonly error: { readonly message: string } | null;
}) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    or: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };
  return builder;
}

describe('processSmsStatusCallback', () => {
  beforeEach(() => {
    getServiceSupabaseClientMock.mockReset();
  });

  it('finalizes the signed SMS attempt with the provider terminal status', async () => {
    const attemptQuery = createAttemptQuery({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        recipient_phone: '+447700900001',
      },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({ data: 'delivered', error: null });
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => attemptQuery),
      rpc,
    });

    await expect(
      processSmsStatusCallback({
        attemptId: '33333333-3333-4333-8333-333333333333',
        errorCode: null,
        messageSid: 'SM123',
        providerStatus: 'delivered',
        recipientPhone: '+447700900001',
      }),
    ).resolves.toEqual({ ignored: false, status: 'delivered' });

    expect(rpc).toHaveBeenCalledWith('finalize_mobile_sms_attempt', {
      p_attempt_id: '33333333-3333-4333-8333-333333333333',
      p_error_code: null,
      p_provider_message_id: 'SM123',
      p_status: 'delivered',
    });
  });

  it('ignores a callback whose signed attempt belongs to another recipient', async () => {
    const attemptQuery = createAttemptQuery({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        recipient_phone: '+447700900099',
      },
      error: null,
    });
    const rpc = vi.fn();
    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => attemptQuery),
      rpc,
    });

    await expect(
      processSmsStatusCallback({
        attemptId: '33333333-3333-4333-8333-333333333333',
        errorCode: null,
        messageSid: 'SM123',
        providerStatus: 'delivered',
        recipientPhone: '+447700900001',
      }),
    ).resolves.toEqual({ ignored: true, status: null });

    expect(rpc).not.toHaveBeenCalled();
  });
});
