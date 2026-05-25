import { isDualSyncSectionKey } from './dualSyncWorkspaceDomain';

import type { DualSyncDecisionEntry } from './dualSyncWorkspaceDecisionDomain';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  GetDualSyncStateResponse,
} from '@/services/ops/dual-sync';

export interface DualSyncPendingPublishPreview {
  readonly request: DualSyncPublishRequest;
  readonly plan: DualSyncPublishPreviewResponse;
}

export function buildDualSyncPublishRequest(
  stateData: GetDualSyncStateResponse | null | undefined,
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
): DualSyncPublishRequest | null {
  if (!stateData) {
    return null;
  }

  const fieldByKey = new Map(stateData.fields.map((field) => [field.fieldKey, field]));
  const payload = Object.entries(decisions)
    .map(([fieldKey, entry]) => {
      const field = fieldByKey.get(fieldKey);
      if (!field || !isDualSyncSectionKey(field.sectionKey)) return null;
      return {
        fieldKey,
        sectionKey: field.sectionKey,
        action: entry.action,
        pinnedCoreHash: field.coreCanonicalHash,
        pinnedGbpHash: field.gbpCanonicalHash,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (payload.length === 0) {
    return null;
  }

  return {
    decisions: payload,
    clientRequestId: createDualSyncClientRequestId(),
    pinnedCoreSnapshotHash: stateData.coreSnapshotHash ?? null,
    pinnedGbpSnapshotHash: stateData.gbpSnapshotHash ?? null,
  };
}

export function buildConfirmedDualSyncPublishRequest(
  pendingPreview: DualSyncPendingPublishPreview,
): DualSyncPublishRequest | null {
  const acceptedDecisions = pendingPreview.plan.groups.flatMap((group) => group.fields);
  if (acceptedDecisions.length === 0) {
    return null;
  }

  return {
    ...pendingPreview.request,
    decisions: acceptedDecisions,
    pinnedCoreSnapshotHash: pendingPreview.plan.coreSnapshotHash,
    pinnedGbpSnapshotHash: pendingPreview.plan.gbpSnapshotHash,
  };
}

function createDualSyncClientRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `dual-sync-${Date.now()}`;
}
