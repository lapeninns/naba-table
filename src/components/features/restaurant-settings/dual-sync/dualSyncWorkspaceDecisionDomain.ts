import { fieldNeedsOperatorChoice } from './workspace-progress';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncDecisionEntry {
  readonly action: DualSyncDecisionAction;
}

export interface DualSyncSectionBulkSummary {
  readonly importable: number;
  readonly exportable: number;
  readonly ignorable: number;
  readonly selected: number;
}

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
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
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

export function setDualSyncFieldDecision(
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
  fieldKey: string,
  next: DualSyncDecisionAction | null,
): Record<string, DualSyncDecisionEntry> {
  const updated = { ...decisions };
  if (next === null) {
    delete updated[fieldKey];
  } else {
    updated[fieldKey] = { action: next };
  }
  return updated;
}

export function setDualSyncSectionDecisions(
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
  fields: ReadonlyArray<DualSyncFieldSummary>,
  action: DualSyncDecisionAction,
): Record<string, DualSyncDecisionEntry> {
  const updated = { ...decisions };
  for (const field of fields) {
    if (fieldNeedsOperatorChoice(field) && canApplyFieldAction(field, action)) {
      updated[field.fieldKey] = { action };
    }
  }
  return updated;
}

export function clearDualSyncSectionDecisions(
  decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
  fields: ReadonlyArray<DualSyncFieldSummary>,
): Record<string, DualSyncDecisionEntry> {
  const updated = { ...decisions };
  for (const field of fields) {
    delete updated[field.fieldKey];
  }
  return updated;
}
