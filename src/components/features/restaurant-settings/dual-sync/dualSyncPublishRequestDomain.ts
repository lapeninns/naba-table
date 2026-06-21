import {
  buildConfirmedDualSyncPublishRequest,
  buildDualSyncPublishRequest,
  type DualSyncPendingPublishPreview,
} from './dualSyncPublishPayloadDomain';

import type { DualSyncDecisionEntry } from './dualSyncWorkspaceDecisionDomain';
import type { DualSyncPublishRequest, GetDualSyncStateResponse } from '@/services/ops/dual-sync';

export {
  buildConfirmedDualSyncPublishRequest,
  buildDualSyncPublishRequest,
  type DualSyncPendingPublishPreview,
} from './dualSyncPublishPayloadDomain';

export type DualSyncPublishReadiness =
  | {
      readonly kind: 'blocked';
      readonly message: string | null;
    }
  | {
      readonly kind: 'ready';
      readonly request: DualSyncPublishRequest;
    };

export interface BuildDualSyncPublishPreviewReadinessInput {
  readonly stateData: GetDualSyncStateResponse | null | undefined;
  readonly decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly canSubmit: boolean;
}

export function buildDualSyncPublishPreviewReadiness({
  stateData,
  decisions,
  syncPaused,
  pauseReason,
  canSubmit,
}: BuildDualSyncPublishPreviewReadinessInput): DualSyncPublishReadiness {
  if (syncPaused) {
    return {
      kind: 'blocked',
      message: pauseReason,
    };
  }

  if (!canSubmit) {
    return {
      kind: 'blocked',
      message: null,
    };
  }

  if (!stateData) {
    return {
      kind: 'blocked',
      message: 'Dual-sync state has not loaded yet.',
    };
  }

  const request = buildDualSyncPublishRequest(stateData, decisions);
  if (!request) {
    return {
      kind: 'blocked',
      message: 'No valid decisions to publish.',
    };
  }

  return {
    kind: 'ready',
    request,
  };
}

export function buildDualSyncConfirmPublishReadiness(
  pendingPreview: DualSyncPendingPublishPreview | null,
): DualSyncPublishReadiness {
  if (!pendingPreview) {
    return {
      kind: 'blocked',
      message: null,
    };
  }

  const request = buildConfirmedDualSyncPublishRequest(pendingPreview);
  if (!request) {
    return {
      kind: 'blocked',
      message: 'No accepted decisions to publish.',
    };
  }

  return {
    kind: 'ready',
    request,
  };
}
