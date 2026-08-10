import type { NormalizedGoogleMasks } from '@/server/google-business-profile/googleUpdates';

export const EXACT_CONSENT_VERSION = 'gbp-exact-consent-v1' as const;
export const EXACT_CONSENT_POLICY_VERSION = 'gbp-write-policy-v1' as const;
export const EXACT_CONSENT_RENDERER_VERSION = 'gbp-renderer-v1' as const;

export type ExactConsentRiskAcknowledgement =
  | 'external_write'
  | 'outcome_may_be_unknown'
  | 'partial_bundle_failure'
  | 'destructive_full_replacement';

export type ExactConsentListing = {
  readonly restaurantId: string;
  readonly externalProfileRowId: string;
  readonly accountId: string;
  readonly profileId: string;
  readonly locationId: string;
  readonly connectionGeneration: number;
  readonly consentEpoch: number;
};

export type ExactConsentValueSides = {
  readonly core: Readonly<Record<string, unknown>>;
  readonly google: Readonly<Record<string, unknown>>;
};

export type ExactConsentGroupDraft = {
  readonly groupId: string;
  readonly writeGroup: string;
  readonly fieldKeys: readonly string[];
  readonly method: 'PATCH' | 'POST' | 'DELETE';
  readonly resource: string;
  readonly updateMasks: readonly string[];
  readonly before: ExactConsentValueSides;
  readonly after: ExactConsentValueSides;
  readonly request: unknown;
  readonly warnings: readonly string[];
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly fullReplacement: boolean;
};

export type ExactConsentPreviewDraft = {
  readonly listing: ExactConsentListing;
  readonly snapshotPins: { readonly core: string; readonly google: string };
  readonly decisions: readonly Readonly<Record<string, unknown>>[];
  readonly groups: readonly ExactConsentGroupDraft[];
};

export type ExactConsentSideHashes = {
  readonly core: Readonly<Record<string, string>>;
  readonly google: Readonly<Record<string, string>>;
};

export type ExactConsentPreviewGroup = {
  readonly groupId: string;
  readonly writeGroup: string;
  readonly direction: 'export_to_google';
  readonly fieldKeys: readonly string[];
  readonly method: 'PATCH' | 'POST' | 'DELETE';
  readonly resource: string;
  readonly updateMasks: readonly string[];
  readonly beforeDisplay: ExactConsentValueSides;
  readonly afterDisplay: ExactConsentValueSides;
  readonly beforeHashes: ExactConsentSideHashes;
  readonly afterHashes: ExactConsentSideHashes;
  readonly requestHash: string;
  readonly decisionHash: string;
  readonly warnings: readonly string[];
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly fullReplacement: boolean;
};

export type ExactConsentPreview = {
  readonly confirmationVersion: typeof EXACT_CONSENT_VERSION;
  readonly policyVersion: typeof EXACT_CONSENT_POLICY_VERSION;
  readonly rendererVersion: typeof EXACT_CONSENT_RENDERER_VERSION;
  readonly listing: ExactConsentListing;
  readonly snapshotPins: { readonly core: string; readonly google: string };
  readonly groups: readonly ExactConsentPreviewGroup[];
  readonly planFingerprint: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
};

export type ExactConsentGoogleUpdates = {
  readonly location: {
    readonly diffMask: NormalizedGoogleMasks;
    readonly pendingMask: NormalizedGoogleMasks;
  };
  readonly attributes?: {
    readonly diffMask: NormalizedGoogleMasks;
    readonly pendingMask: NormalizedGoogleMasks;
  };
};

export type ExactConsentTerminalStatus =
  | 'consumed'
  | 'failed'
  | 'outcome_unknown'
  | 'cancelled_before_dispatch'
  | 'cancelled_after_bundle_failure';

export type ExactConsentGroupOutcome = {
  readonly groupId: string;
  readonly status: ExactConsentTerminalStatus;
  readonly reasonCode: string;
};

export type ExactConsentErrorCode =
  | 'GBP_PREVIEW_EXPIRED'
  | 'GBP_PREVIEW_MISMATCH'
  | 'GBP_ACKNOWLEDGEMENT_REQUIRED'
  | 'GBP_RISK_ACKNOWLEDGEMENT_REQUIRED'
  | 'GBP_UNKNOWN_UPDATE_MASK'
  | 'GBP_UPDATE_MASK_CONFLICT'
  | 'GBP_ATTRIBUTES_COMPARISON_REQUIRED'
  | 'GBP_QUEUE_STALE'
  | 'GBP_CONNECTION_INELIGIBLE'
  | 'GBP_SYNC_PAUSED'
  | 'GBP_RUNTIME_FLAG_DISABLED'
  | 'GBP_ROLLOUT_INELIGIBLE'
  | 'GBP_READINESS_UNPROVEN';

export class ExactConsentError extends Error {
  readonly code: ExactConsentErrorCode;
  readonly status = 409;

  constructor(code: ExactConsentErrorCode, message: string) {
    super(message);
    this.name = 'ExactConsentError';
    this.code = code;
  }
}

export type ExactConsentExecutionPhase =
  | 'preflight'
  | 'issuance'
  | 'provider_before_dispatch'
  | 'provider_after_dispatch'
  | 'cancellation';

function executionErrorDetails(phase: ExactConsentExecutionPhase): {
  readonly code:
    | 'GBP_PREFLIGHT_UNAVAILABLE'
    | 'GBP_GRANT_ISSUANCE_FAILED'
    | 'GBP_OUTCOME_UNKNOWN'
    | 'GBP_CLAIM_CANCELLATION_FAILED';
  readonly message: string;
  readonly status: 500 | 502 | 503;
} {
  switch (phase) {
    case 'preflight':
    case 'provider_before_dispatch':
      return {
        code: 'GBP_PREFLIGHT_UNAVAILABLE',
        message: 'Google listing state could not be refreshed safely.',
        status: 503,
      };
    case 'issuance':
      return {
        code: 'GBP_GRANT_ISSUANCE_FAILED',
        message: 'The Google write approval could not be issued.',
        status: 503,
      };
    case 'provider_after_dispatch':
      return {
        code: 'GBP_OUTCOME_UNKNOWN',
        message: 'Google may have received the write; the outcome is unknown.',
        status: 502,
      };
    case 'cancellation':
      return {
        code: 'GBP_CLAIM_CANCELLATION_FAILED',
        message: 'The claimed Google write approval could not be cancelled safely.',
        status: 500,
      };
  }
}

export class ExactConsentExecutionError extends Error {
  readonly phase: ExactConsentExecutionPhase;
  readonly code:
    | 'GBP_PREFLIGHT_UNAVAILABLE'
    | 'GBP_GRANT_ISSUANCE_FAILED'
    | 'GBP_OUTCOME_UNKNOWN'
    | 'GBP_CLAIM_CANCELLATION_FAILED';
  readonly status: 500 | 502 | 503;

  constructor(phase: ExactConsentExecutionPhase) {
    const details = executionErrorDetails(phase);
    super(details.message);
    this.name = 'ExactConsentExecutionError';
    this.phase = phase;
    this.code = details.code;
    this.status = details.status;
  }
}
