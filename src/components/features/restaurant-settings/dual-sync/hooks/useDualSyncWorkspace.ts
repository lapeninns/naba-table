import { useEffect, useMemo, useState } from 'react';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';

import {
  computeSectionReviewProgress,
  computeWorkspaceReviewProgress,
  fieldNeedsOperatorChoice,
} from '../workspace-progress';

import type { DualSyncDecisionAction, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export const DUAL_SYNC_SECTION_LABEL: Record<DualSyncSectionKey, string> = {
  profile: 'Profile',
  operatingHours: 'Operating hours',
  servicePeriods: 'Service periods',
  'businessContext.categories': 'Categories',
  'businessContext.serviceAreas': 'Service areas',
  'businessContext.attributes': 'Attributes',
  'businessContext.serviceItems': 'Service items',
  foodMenus: 'Food menus',
};

export const DUAL_SYNC_SECTION_ORDER: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
];

export const DUAL_SYNC_PANEL_VALUES = {
  metrics: '__metrics',
  pendingCandidates: '__pendingCandidates',
  queueJobs: '__queueJobs',
  publishes: '__publishes',
  operations: '__operations',
} as const;

export interface DualSyncDecisionEntry {
  readonly action: DualSyncDecisionAction;
}

export interface DualSyncSectionBulkSummary {
  readonly importable: number;
  readonly exportable: number;
  readonly ignorable: number;
  readonly selected: number;
}

type UseDualSyncWorkspaceArgs = {
  restaurantId: string;
  sections?: ReadonlyArray<DualSyncSectionKey>;
  singleOpenSections: boolean;
};

export const isDualSyncSectionKey = (value: string): value is DualSyncSectionKey =>
  DUAL_SYNC_SECTION_ORDER.includes(value as DualSyncSectionKey);

export function canApplyFieldAction(
  field: DualSyncFieldSummary,
  action: DualSyncDecisionAction,
): boolean {
  if (field.conflictPolicy === 'unsupported') return false;
  if (action === 'import_from_google') return field.capability.canImport;
  if (action === 'export_to_google') return field.capability.canExport;
  return field.capability.canIgnore;
}

export function getDualSyncSectionBulkSummary(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: Record<string, DualSyncDecisionEntry>,
): DualSyncSectionBulkSummary {
  return fields.reduce<DualSyncSectionBulkSummary>(
    (summary, field) => {
      const actionable = fieldNeedsOperatorChoice(field);
      return {
        importable:
          summary.importable +
          (actionable && canApplyFieldAction(field, 'import_from_google') ? 1 : 0),
        exportable:
          summary.exportable +
          (actionable && canApplyFieldAction(field, 'export_to_google') ? 1 : 0),
        ignorable: summary.ignorable + (actionable && canApplyFieldAction(field, 'ignore') ? 1 : 0),
        selected: summary.selected + (decisions[field.fieldKey] ? 1 : 0),
      };
    },
    { importable: 0, exportable: 0, ignorable: 0, selected: 0 },
  );
}

export function useDualSyncWorkspace({
  restaurantId,
  sections,
  singleOpenSections,
}: UseDualSyncWorkspaceArgs) {
  const [showOperationalHealth, setShowOperationalHealth] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [showPendingCandidates, setShowPendingCandidates] = useState(false);
  const [showQueueJobs, setShowQueueJobs] = useState(false);
  const [showPublishJobs, setShowPublishJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DualSyncDecisionEntry>>({});
  const [openSection, setOpenSection] = useState<string | undefined>(undefined);

  const dualSync = useOpsDualSync({
    restaurantId,
    operationsRequest: showOperations ? { limit: 50 } : undefined,
    candidatesRequest: showPendingCandidates ? { limit: 50, statuses: ['open'] } : undefined,
    jobsRequest: showQueueJobs
      ? { limit: 25, statuses: ['queued', 'running', 'retrying', 'dead_letter', 'failed'] }
      : undefined,
    metricsRequest: showOperationalHealth ? { windowHours: 24, limit: 200 } : undefined,
    publishJobsRequest: showPublishJobs ? { jobLimit: 25 } : undefined,
    publishJobDetailId: showPublishJobs ? selectedJobId : null,
  });

  const fields = useMemo(
    () => dualSync.stateQuery.data?.fields ?? [],
    [dualSync.stateQuery.data?.fields],
  );

  const visibleFields = useMemo<ReadonlyArray<DualSyncFieldSummary>>(() => {
    if (!sections || sections.length === 0) {
      return fields.filter((field) => isDualSyncSectionKey(field.sectionKey));
    }
    const allowed = new Set<DualSyncSectionKey>(sections);
    return fields.filter((field) =>
      isDualSyncSectionKey(field.sectionKey)
        ? allowed.has(field.sectionKey as DualSyncSectionKey)
        : false,
    );
  }, [fields, sections]);

  const workspaceProgress = useMemo(
    () => computeWorkspaceReviewProgress(visibleFields, decisions),
    [visibleFields, decisions],
  );

  const fieldsBySection = useMemo(() => {
    const grouped = new Map<DualSyncSectionKey, DualSyncFieldSummary[]>();
    for (const field of visibleFields) {
      if (!isDualSyncSectionKey(field.sectionKey)) continue;
      const arr = grouped.get(field.sectionKey) ?? [];
      arr.push(field);
      grouped.set(field.sectionKey, arr);
    }
    for (const arr of grouped.values()) {
      arr.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [visibleFields]);

  const orderedSectionKeys = useMemo(
    () => DUAL_SYNC_SECTION_ORDER.filter((key) => fieldsBySection.has(key)),
    [fieldsBySection],
  );

  const orderedAccordionValues = useMemo(() => {
    const values = orderedSectionKeys.map((key) => key as string);
    values.push(DUAL_SYNC_PANEL_VALUES.metrics);
    values.push(DUAL_SYNC_PANEL_VALUES.pendingCandidates);
    values.push(DUAL_SYNC_PANEL_VALUES.queueJobs);
    values.push(DUAL_SYNC_PANEL_VALUES.publishes, DUAL_SYNC_PANEL_VALUES.operations);
    return values;
  }, [orderedSectionKeys]);

  useEffect(() => {
    setDecisions({});
  }, [dualSync.stateQuery.data?.coreSnapshotHash, dualSync.stateQuery.data?.gbpSnapshotHash]);

  useEffect(() => {
    if (!singleOpenSections) {
      return;
    }
    setOpenSection((current) => {
      if (current && orderedAccordionValues.includes(current)) {
        return current;
      }
      return orderedAccordionValues[0];
    });
  }, [orderedAccordionValues, singleOpenSections]);

  const onSelectAction = (fieldKey: string, next: DualSyncDecisionAction | null) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      if (next === null) {
        delete updated[fieldKey];
      } else {
        updated[fieldKey] = { action: next };
      }
      return updated;
    });
  };

  const onBulkSelectSection = (
    sectionFields: ReadonlyArray<DualSyncFieldSummary>,
    action: DualSyncDecisionAction,
  ) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      for (const field of sectionFields) {
        if (fieldNeedsOperatorChoice(field) && canApplyFieldAction(field, action)) {
          updated[field.fieldKey] = { action };
        }
      }
      return updated;
    });
  };

  const onClearSection = (sectionFields: ReadonlyArray<DualSyncFieldSummary>) => {
    setDecisions((prev) => {
      const updated = { ...prev };
      for (const field of sectionFields) {
        delete updated[field.fieldKey];
      }
      return updated;
    });
  };

  return {
    ...dualSync,
    decisions,
    setDecisions,
    decisionCount: Object.keys(decisions).length,
    fieldsBySection,
    openSection,
    orderedAccordionValues,
    orderedSectionKeys,
    selectedJobId,
    setOpenSection,
    setSelectedJobId,
    setShowOperationalHealth,
    setShowOperations,
    setShowPendingCandidates,
    setShowPublishJobs,
    setShowQueueJobs,
    showOperationalHealth,
    showOperations,
    showPendingCandidates,
    showPublishJobs,
    showQueueJobs,
    visibleFields,
    workspaceProgress,
    getSectionProgress: computeSectionReviewProgress,
    onBulkSelectSection,
    onClearSection,
    onSelectAction,
  };
}
