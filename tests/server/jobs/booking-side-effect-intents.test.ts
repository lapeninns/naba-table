import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import {
  runClaimedBookingEmailIntent,
  settleBookingEmailIntent,
} from '@/server/jobs/booking-side-effect-intents';

type Row = {
  id: string;
  restaurant_id: string;
  status: string;
  attempts_made: number;
  claim_generation?: number;
};

function claimedRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'intent-1',
    restaurant_id: 'rest-1',
    status: 'processing',
    attempts_made: 1,
    claim_generation: 7,
    ...overrides,
  };
}

function clientReturning(claim: Row | null, settle: string | null = 'sent') {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'claim_booking_email_intent') {
      return { data: claim ? [claim] : [], error: null };
    }
    return { data: settle, error: null };
  });
  return { client: { rpc } as never, rpc };
}

describe('booking email intent settle fence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles through the claim-generation fence when the claim carries one', async () => {
    const { client, rpc } = clientReturning(claimedRow());

    const outcome = await runClaimedBookingEmailIntent(
      client,
      { dedupeKey: 'email__confirmation__b-1', restaurantId: 'rest-1', bookingId: 'b-1' },
      async () => 'sent',
    );

    expect(outcome).toBe('sent');
    expect(rpc).toHaveBeenCalledWith('settle_booking_email_intent_v2', {
      p_intent_id: 'intent-1',
      p_restaurant_id: 'rest-1',
      p_outcome: 'sent',
      p_claim_generation: 7,
      p_error_code: null,
      p_retry_delay_seconds: 60,
    });
    expect(rpc).not.toHaveBeenCalledWith('settle_booking_email_intent', expect.anything());
  });

  it('passes the claim generation on a failed inline send so only that claim goes back to pending', async () => {
    const { client, rpc } = clientReturning(claimedRow({ claim_generation: 3 }), 'pending');

    const outcome = await runClaimedBookingEmailIntent(
      client,
      {
        dedupeKey: 'email__confirmation__b-1',
        restaurantId: 'rest-1',
        bookingId: 'b-1',
        retryDelaySeconds: 120,
      },
      async () => {
        throw new Error('provider down');
      },
    );

    expect(outcome).toBe('retry_scheduled');
    expect(rpc).toHaveBeenCalledWith('settle_booking_email_intent_v2', {
      p_intent_id: 'intent-1',
      p_restaurant_id: 'rest-1',
      p_outcome: 'retry',
      p_claim_generation: 3,
      p_error_code: 'INLINE_SEND_FAILED',
      p_retry_delay_seconds: 120,
    });
  });

  it('falls back to the attempts fence when the claimed row has no claim generation', async () => {
    const legacy = claimedRow({ attempts_made: 2 });
    delete legacy.claim_generation;
    const { client, rpc } = clientReturning(legacy);

    await runClaimedBookingEmailIntent(
      client,
      { dedupeKey: 'email__confirmation__b-1', restaurantId: 'rest-1', bookingId: 'b-1' },
      async () => 'skipped',
    );

    expect(rpc).toHaveBeenCalledWith('settle_booking_email_intent', {
      p_intent_id: 'intent-1',
      p_restaurant_id: 'rest-1',
      p_outcome: 'skipped',
      p_expected_attempts: 2,
      p_error_code: null,
      p_retry_delay_seconds: 60,
    });
    expect(rpc).not.toHaveBeenCalledWith('settle_booking_email_intent_v2', expect.anything());
  });

  it('reports a lost claim (stale generation) as no settle and logs no guest data', async () => {
    const { client } = clientReturning(null, null);

    const result = await settleBookingEmailIntent(client, {
      intentId: 'intent-1',
      restaurantId: 'rest-1',
      claimGeneration: 4,
      expectedAttempts: 1,
      outcome: 'sent',
    });

    expect(result).toBeNull();
    expect(loggerMock.warn).toHaveBeenCalledWith('[jobs][email-intent] settle matched no claim', {
      intentId: 'intent-1',
      outcome: 'sent',
    });
  });

  it('swallows an RPC error and logs only its code', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: '08006', message: 'raw' } }));

    const result = await settleBookingEmailIntent({ rpc } as never, {
      intentId: 'intent-1',
      restaurantId: 'rest-1',
      claimGeneration: 4,
      expectedAttempts: 1,
      outcome: 'retry',
    });

    expect(result).toBeNull();
    expect(loggerMock.error).toHaveBeenCalledWith('[jobs][email-intent] settle failed', {
      intentId: 'intent-1',
      outcome: 'retry',
      errorCode: '08006',
    });
  });
});
