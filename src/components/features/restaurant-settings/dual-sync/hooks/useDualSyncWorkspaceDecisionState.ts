import { useCallback, useEffect, useState } from 'react';

import {
  clearDualSyncSectionDecisions,
  setDualSyncFieldDecision,
  setDualSyncSectionDecisions,
  type DualSyncDecisionEntry,
} from '../dualSyncWorkspaceDecisionDomain';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

interface UseDualSyncWorkspaceDecisionStateArgs {
  readonly coreSnapshotHash?: string | null;
  readonly gbpSnapshotHash?: string | null;
}

export function useDualSyncWorkspaceDecisionState({
  coreSnapshotHash,
  gbpSnapshotHash,
}: UseDualSyncWorkspaceDecisionStateArgs) {
  const [decisions, setDecisions] = useState<Record<string, DualSyncDecisionEntry>>({});

  useEffect(() => {
    setDecisions({});
  }, [coreSnapshotHash, gbpSnapshotHash]);

  const onSelectAction = useCallback((fieldKey: string, next: DualSyncDecisionAction | null) => {
    setDecisions((prev) => setDualSyncFieldDecision(prev, fieldKey, next));
  }, []);

  const onBulkSelectSection = useCallback(
    (sectionFields: ReadonlyArray<DualSyncFieldSummary>, action: DualSyncDecisionAction) => {
      setDecisions((prev) => setDualSyncSectionDecisions(prev, sectionFields, action));
    },
    [],
  );

  const onClearSection = useCallback((sectionFields: ReadonlyArray<DualSyncFieldSummary>) => {
    setDecisions((prev) => clearDualSyncSectionDecisions(prev, sectionFields));
  }, []);

  return {
    decisions,
    setDecisions,
    decisionCount: Object.keys(decisions).length,
    onBulkSelectSection,
    onClearSection,
    onSelectAction,
  };
}
