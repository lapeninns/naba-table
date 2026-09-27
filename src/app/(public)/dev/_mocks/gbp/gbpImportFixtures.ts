import type { DualSyncPublishGroup, DualSyncPublishPlan } from '@/server/dual-sync/publish/types';
import type { DualSyncPublishResponse, GetDualSyncStateResponse } from '@/services/ops/dual-sync';

export function gbpImportPreview(
  keys: readonly string[],
  state: GetDualSyncStateResponse,
): DualSyncPublishPlan {
  const fields = state.fields.filter((field) => keys.includes(field.fieldKey));
  if (!state.coreSnapshotHash || !state.gbpSnapshotHash) {
    throw new Error('The import fixture requires a checked comparison.');
  }
  const groups = fields.flatMap((field): DualSyncPublishGroup[] => {
    if (field.sectionKey === 'core_only') return [];
    return [
      {
        groupId: `import:${field.fieldKey}`,
        direction: 'import_from_google',
        sectionKey: field.sectionKey,
        writeGroup: `core.${field.sectionKey}`,
        fields: [
          {
            fieldKey: field.fieldKey,
            sectionKey: field.sectionKey,
            action: 'import_from_google',
            pinnedCoreHash: field.coreCanonicalHash,
            pinnedGbpHash: field.gbpCanonicalHash,
          },
        ],
        riskLevel: 'low',
        requiresPreflight: false,
        requiresManualConfirmation: false,
        destructiveWritePossible: false,
        googleUpdateMasks: [],
      },
    ];
  });
  return {
    restaurantId: state.restaurantId,
    coreSnapshotHash: state.coreSnapshotHash,
    gbpSnapshotHash: state.gbpSnapshotHash,
    groups,
    acceptedCount: groups.length,
    rejectedCount: 0,
    ignoredCount: 0,
    rejected: [],
    warnings: [],
  };
}

export function gbpImportResponse(plan: DualSyncPublishPlan): DualSyncPublishResponse {
  return {
    publishJobId: 'dev-import-job',
    restaurantId: plan.restaurantId,
    totalDecisions: plan.acceptedCount,
    succeededCount: plan.acceptedCount,
    failedCount: 0,
    skippedCount: 0,
    operations: [],
    failures: [],
  };
}
