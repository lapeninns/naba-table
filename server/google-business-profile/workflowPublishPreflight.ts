import { hashJson } from './workflowSerialization';

import type { GoogleBusinessProfileFieldDecision } from './workflowFieldDecisions';
import type { GoogleBusinessProfileGoogleUpdateMask } from './workflowGoogleUpdateMasks';
import type {
  GoogleBusinessProfilePublishDirectionIntent,
  GoogleBusinessProfilePublishMode,
} from './workflowPublishDirection';

export type GoogleBusinessProfilePublishPreflightNotice<SectionKey extends string = string> = {
  code: string;
  message: string;
  fieldKey?: string;
  sectionKey?: SectionKey;
  googleUpdateMask?: GoogleBusinessProfileGoogleUpdateMask;
};

type GoogleBusinessProfilePreflightWarningItem<SectionKey extends string = string> = {
  fieldKey: string;
  label: string;
  sectionKey: SectionKey;
  status: string;
  canPushToGoogle: boolean;
};

type GoogleBusinessProfilePushEnabledProfile = {
  push_enabled?: boolean | null;
};

type GoogleBusinessProfilePublishPreflightResponseContext<
  SectionKey extends string,
  Decision,
  DraftItem,
> = {
  mode: GoogleBusinessProfilePublishMode;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  selectedApprovals: Record<string, boolean>;
  decisions: Decision[];
  nabatableUpdates: DraftItem[];
  googleUpdates: DraftItem[];
  pullOnlyItems: DraftItem[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
  warnings: Array<GoogleBusinessProfilePublishPreflightNotice<SectionKey>>;
  errors: Array<GoogleBusinessProfilePublishPreflightNotice<SectionKey>>;
};

type GoogleBusinessProfilePublishPreflightResponseJob = {
  id: string;
  idempotency_key: string;
};

export function createWorkflowNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function assertGooglePushEnabled(
  externalProfile: GoogleBusinessProfilePushEnabledProfile | null,
) {
  if (externalProfile?.push_enabled) {
    return;
  }

  throw createWorkflowNamedError(
    'GBP_GOOGLE_PUSH_DISABLED',
    'Google writes are disabled for this linked Google Business Profile location.',
  );
}

export function buildPublishJobIdempotencyKey<SectionKey extends string = string>(input: {
  restaurantId: string;
  draftId: string;
  mode: GoogleBusinessProfilePublishMode;
  selectedApprovals: Record<string, boolean>;
  decisions: Array<GoogleBusinessProfileFieldDecision<SectionKey>>;
  currentHashes: Record<string, string>;
}): string {
  return `gbp-publish:${input.restaurantId}:${input.draftId}:${hashJson({
    mode: input.mode,
    selectedApprovals: input.selectedApprovals,
    decisions: input.decisions.map((decision) => ({
      sectionKey: decision.sectionKey,
      fieldKey: decision.fieldKey,
      action: decision.action,
      reviewedNabatableValueHash: decision.reviewedNabatableValueHash,
      reviewedGoogleValueHash: decision.reviewedGoogleValueHash,
    })),
    currentHashes: input.currentHashes,
  })}`;
}

export function publishModeForDecisions(
  decisions: Array<GoogleBusinessProfileFieldDecision<string>>,
): GoogleBusinessProfilePublishMode | null {
  const imports = decisions.some((decision) => decision.action === 'import_from_google');
  const exports = decisions.some((decision) => decision.action === 'export_to_google');
  if (imports && exports) {
    return 'nabatable_and_google';
  }
  if (exports) {
    return 'google_only';
  }
  if (imports) {
    return 'nabatable_only';
  }
  return null;
}

export function buildPreflightWarnings<
  SectionKey extends string,
  Item extends GoogleBusinessProfilePreflightWarningItem<SectionKey>,
>(input: {
  mode: GoogleBusinessProfilePublishMode;
  selectedDraftItems: Item[];
  googleUpdateMasks: GoogleBusinessProfileGoogleUpdateMask[];
}): Array<GoogleBusinessProfilePublishPreflightNotice<SectionKey>> {
  const warnings: Array<GoogleBusinessProfilePublishPreflightNotice<SectionKey>> = [];

  if (input.mode === 'nabatable_only') {
    return warnings;
  }

  for (const item of input.selectedDraftItems) {
    if (!item.canPushToGoogle) {
      warnings.push({
        code: item.status === 'unsupported' ? 'unsupported_field' : 'google_read_only',
        message:
          input.mode === 'google_only'
            ? `${item.label} cannot be sent to Google from here yet and will be skipped.`
            : `${item.label} will update Nabatable only and will not be sent to Google.`,
        fieldKey: item.fieldKey,
        sectionKey: item.sectionKey,
      });
    }
  }

  if (input.googleUpdateMasks.length === 0) {
    warnings.push({
      code: 'no_google_masks',
      message:
        input.mode === 'google_only'
          ? 'No selected fields can be sent to Google.'
          : 'No selected fields can be sent to Google. This will update Nabatable only.',
    });
  }

  return warnings;
}

export function buildPublishPreflightResponse<
  SectionKey extends string,
  Decision,
  DraftItem,
  ActivePublishJob,
>(input: {
  context: GoogleBusinessProfilePublishPreflightResponseContext<SectionKey, Decision, DraftItem>;
  job: GoogleBusinessProfilePublishPreflightResponseJob;
  activePublishJob: ActivePublishJob;
}) {
  const { context, job } = input;

  return {
    publishJobId: job.id,
    publishPlanId: job.id,
    idempotencyKey: job.idempotency_key,
    mode: context.mode,
    directionIntent: context.directionIntent,
    selectedApprovals: context.selectedApprovals,
    decisions: context.decisions,
    nabatableUpdates: context.nabatableUpdates,
    googleUpdates: context.googleUpdates,
    pullOnlyItems: context.pullOnlyItems,
    googleUpdateMasks: context.googleUpdateMasks,
    warnings: context.warnings,
    errors: context.errors,
    canPublish:
      context.errors.length === 0 &&
      (context.mode === 'google_only'
        ? context.googleUpdateMasks.length > 0
        : context.nabatableUpdates.length > 0),
    canPushToGoogle: context.mode !== 'nabatable_only' && context.googleUpdateMasks.length > 0,
    activePublishJob: input.activePublishJob,
  };
}
