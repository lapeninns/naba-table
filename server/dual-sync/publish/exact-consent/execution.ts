import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';

import type { ExactConsentGroupOutcome, ExactConsentTerminalStatus } from './types';

type ExecutableGroup = {
  readonly groupId: string;
  readonly dispatch: () => Promise<unknown>;
};

type FinalizedOutcome = ExactConsentGroupOutcome & {
  readonly status: 'consumed' | 'failed' | 'outcome_unknown';
};

function failureStatus(error: unknown): {
  readonly status: Extract<ExactConsentTerminalStatus, 'failed' | 'outcome_unknown'>;
  readonly reasonCode: string;
} {
  const definitive =
    error instanceof GoogleBusinessProfileError &&
    error.upstreamStatus !== undefined &&
    error.upstreamStatus >= 400 &&
    error.upstreamStatus < 500 &&
    error.upstreamStatus !== 408 &&
    error.upstreamStatus !== 429;
  return definitive
    ? { status: 'failed', reasonCode: 'provider_definitive_rejection' }
    : { status: 'outcome_unknown', reasonCode: 'provider_outcome_unknown' };
}

export async function executeExactConsentBundle(input: {
  readonly groups: readonly ExecutableGroup[];
  readonly markDispatched: (groupId: string, bundleOrder: number) => Promise<void>;
  readonly finalize: (outcome: FinalizedOutcome, bundleOrder: number) => Promise<void>;
  readonly cancelBeforeDispatch?: (reasonCode: string) => Promise<void>;
}): Promise<readonly ExactConsentGroupOutcome[]> {
  const outcomes: ExactConsentGroupOutcome[] = [];
  for (const [index, group] of input.groups.entries()) {
    try {
      await input.markDispatched(group.groupId, index + 1);
    } catch {
      await input.cancelBeforeDispatch?.('durable_dispatch_not_recorded');
      for (const remaining of input.groups.slice(index)) {
        outcomes.push({
          groupId: remaining.groupId,
          status: 'cancelled_before_dispatch',
          reasonCode: 'durable_dispatch_not_recorded',
        });
      }
      return outcomes;
    }
    try {
      await group.dispatch();
      const consumed: FinalizedOutcome = {
        groupId: group.groupId,
        status: 'consumed',
        reasonCode: 'provider_succeeded',
      };
      outcomes.push(consumed);
      await input.finalize(consumed, index + 1);
    } catch (error) {
      const failure = failureStatus(error);
      const failed: FinalizedOutcome = { groupId: group.groupId, ...failure };
      outcomes.push(failed);
      await input.finalize(failed, index + 1);
      for (const remaining of input.groups.slice(index + 1)) {
        const cancelled: ExactConsentGroupOutcome = {
          groupId: remaining.groupId,
          status: 'cancelled_after_bundle_failure',
          reasonCode: 'bundle_fail_stopped',
        };
        outcomes.push(cancelled);
      }
      return outcomes;
    }
  }
  return outcomes;
}
