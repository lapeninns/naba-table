import { describe, expect, it, vi } from 'vitest';

import { executeClaimedExactConsent } from '@/server/dual-sync/publish/exact-consent/claimed-execution';
import { ExactConsentExecutionError } from '@/server/dual-sync/publish/exact-consent/types';
import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const CLAIM = {
  restaurantId: '00000000-0000-4000-8000-000000000001',
  bundleId: '00000000-0000-4000-8000-000000000002',
  executionId: '00000000-0000-4000-8000-000000000003',
  grantIds: ['00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'],
} as const;

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseClient<Database> {
  return { rpc } as unknown as SupabaseClient<Database>;
}

describe('claimed exact-consent execution', () => {
  it('cancels the full claimed bundle once when execution fails before dispatch', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: CLAIM.grantIds.map((id) => ({
        id,
        execution_id: CLAIM.executionId,
        status: 'cancelled_before_dispatch',
      })),
      error: null,
    });
    const providerMutation = vi.fn(async () => {
      throw new ExactConsentExecutionError('provider_before_dispatch');
    });

    await expect(
      executeClaimedExactConsent({
        client: clientWithRpc(rpc),
        ...CLAIM,
        execute: providerMutation,
      }),
    ).rejects.toMatchObject({
      code: 'GBP_PREFLIGHT_UNAVAILABLE',
      phase: 'provider_before_dispatch',
    });
    expect(providerMutation).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('cancel_gbp_claimed_bundle_before_dispatch_v1', {
      p_restaurant_id: CLAIM.restaurantId,
      p_bundle_id: CLAIM.bundleId,
      p_execution_id: CLAIM.executionId,
      p_reason_code: 'provider_pre_dispatch_failed',
    });
  });

  it('returns a stable critical error when claimed-bundle cancellation fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'private DB detail' } });
    const execute = vi.fn(async () => {
      throw new ExactConsentExecutionError('provider_before_dispatch');
    });

    await expect(
      executeClaimedExactConsent({ client: clientWithRpc(rpc), ...CLAIM, execute }),
    ).rejects.toMatchObject({
      code: 'GBP_CLAIM_CANCELLATION_FAILED',
      phase: 'cancellation',
      message: 'The claimed Google write approval could not be cancelled safely.',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    new ExactConsentExecutionError('provider_after_dispatch'),
    new GoogleBusinessProfileError('definitive rejection', { upstreamStatus: 400 }),
  ])('does not cancel work that may already be finalized', async (executionFailure) => {
    const rpc = vi.fn();

    await expect(
      executeClaimedExactConsent({
        client: clientWithRpc(rpc),
        ...CLAIM,
        execute: async () => {
          throw executionFailure;
        },
      }),
    ).rejects.toBe(executionFailure);
    expect(rpc).not.toHaveBeenCalled();
  });
});
