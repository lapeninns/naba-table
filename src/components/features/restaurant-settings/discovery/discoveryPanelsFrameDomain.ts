import {
  DISCOVERY_SECTION_DESCRIPTIONS,
  DISCOVERY_SECTION_ORDER,
  TAB_LABELS,
  type DirtyState,
  type ErrorState,
  type FamilyKey,
} from '../businessContextModel';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export type DiscoveryFrameEditorState = {
  dirty: DirtyState;
  errors: ErrorState;
};

export type DiscoverySectionFrameState = {
  family: FamilyKey;
  title: string;
  description: string;
  dirty: boolean;
  hasError: boolean;
  triggerLabel: string;
  driftFields: ReadonlyArray<DualSyncFieldSummary>;
};

export function isDiscoveryFamily(value: string): value is FamilyKey {
  return DISCOVERY_SECTION_ORDER.includes(value as FamilyKey);
}

export function resolveDiscoveryFamily(value: string): FamilyKey | null {
  return isDiscoveryFamily(value) ? value : null;
}

export function formatDiscoveryTriggerLabel({
  title,
  dirty,
  hasError,
}: {
  title: string;
  dirty: boolean;
  hasError: boolean;
}): string {
  return [title, dirty ? 'unsaved changes' : null, hasError ? 'needs attention' : null]
    .filter(Boolean)
    .join(', ');
}

export function buildDiscoverySectionFrameState({
  family,
  editor,
  gbpDriftFieldsByFamily,
}: {
  family: FamilyKey;
  editor: DiscoveryFrameEditorState;
  gbpDriftFieldsByFamily?: Readonly<Record<FamilyKey, ReadonlyArray<DualSyncFieldSummary>>>;
}): DiscoverySectionFrameState {
  const title = TAB_LABELS[family];
  const dirty = editor.dirty[family];
  const hasError = Boolean(editor.errors[family]);

  return {
    family,
    title,
    description: DISCOVERY_SECTION_DESCRIPTIONS[family],
    dirty,
    hasError,
    triggerLabel: formatDiscoveryTriggerLabel({ title, dirty, hasError }),
    driftFields: gbpDriftFieldsByFamily?.[family] ?? [],
  };
}
