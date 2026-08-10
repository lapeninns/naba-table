import { createExactConsentGrantRepository } from './repository';
import { ExactConsentExecutionError } from './types';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

export async function executeClaimedExactConsent<T>(input: {
  readonly client: DbClient;
  readonly restaurantId: string;
  readonly bundleId: string;
  readonly executionId: string;
  readonly grantIds: readonly string[];
  readonly execute: () => Promise<T>;
}): Promise<T> {
  try {
    return await input.execute();
  } catch (failure) {
    if (
      !(failure instanceof ExactConsentExecutionError) ||
      failure.phase !== 'provider_before_dispatch'
    ) {
      throw failure;
    }
    try {
      const cancelled = await createExactConsentGrantRepository(input.client).cancelBeforeDispatch({
        restaurantId: input.restaurantId,
        bundleId: input.bundleId,
        executionId: input.executionId,
        reasonCode: 'provider_pre_dispatch_failed',
      });
      const cancelledIds = new Set(cancelled.map((grant) => grant.id));
      const completeCancellation =
        cancelled.length === input.grantIds.length &&
        cancelled.every(
          (grant) =>
            grant.status === 'cancelled_before_dispatch' &&
            grant.execution_id === input.executionId &&
            input.grantIds.includes(grant.id),
        ) &&
        input.grantIds.every((grantId) => cancelledIds.has(grantId));
      if (!completeCancellation) throw new ExactConsentExecutionError('cancellation');
    } catch (cancellationFailure) {
      if (
        cancellationFailure instanceof ExactConsentExecutionError &&
        cancellationFailure.phase === 'cancellation'
      ) {
        throw cancellationFailure;
      }
      throw new ExactConsentExecutionError('cancellation');
    }
    throw failure;
  }
}
