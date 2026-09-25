import type { OpsStatusTone } from '@/lib/ops/status-tones';
import type { GbpPublishResponseV1 } from '@/services/ops/dual-sync';

type ImmediateGbpPublishResponse = Extract<GbpPublishResponseV1, { mode: 'immediate' }>;

export type GbpPublishOutcomeStatus = ImmediateGbpPublishResponse['outcomes'][number]['status'];

export type GbpPublishOutcomeDescription = {
  readonly label: string;
  readonly tone: Extract<OpsStatusTone, 'success' | 'danger' | 'warning' | 'muted'>;
  readonly detail: string;
};

const OUTCOMES: Record<GbpPublishOutcomeStatus, GbpPublishOutcomeDescription> = {
  consumed: {
    label: 'Confirmed by Google',
    tone: 'success',
    detail: 'Google confirmed this change.',
  },
  failed: {
    label: 'Failed',
    tone: 'danger',
    detail: 'Google did not apply this change. Check the reason code before trying again.',
  },
  outcome_unknown: {
    label: 'Outcome unknown',
    tone: 'warning',
    detail:
      'Google did not confirm the result. Don’t assume it worked: get the latest from Google, then create a new preview. These differences stay listed until then.',
  },
  cancelled_before_dispatch: {
    label: 'Not sent',
    tone: 'muted',
    detail: 'Cancelled before anything was sent to Google.',
  },
  cancelled_after_bundle_failure: {
    label: 'Not sent',
    tone: 'muted',
    detail: 'Cancelled because another part of this publish failed.',
  },
};

/**
 * Plain-language outcome for one exact publish group. `outcome_unknown` is never described as
 * success (ops settings contract §6).
 */
export function describeGbpPublishOutcome(
  status: GbpPublishOutcomeStatus,
): GbpPublishOutcomeDescription {
  return OUTCOMES[status];
}

export function hasUnknownGbpPublishOutcome(result: GbpPublishResponseV1 | null): boolean {
  return (
    result?.mode === 'immediate' &&
    result.outcomes.some((outcome) => outcome.status === 'outcome_unknown')
  );
}
