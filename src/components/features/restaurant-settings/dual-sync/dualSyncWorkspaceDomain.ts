import type { DualSyncSectionKey } from '@/server/dual-sync';
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

export const isDualSyncSectionKey = (value: string): value is DualSyncSectionKey =>
  DUAL_SYNC_SECTION_ORDER.includes(value as DualSyncSectionKey);

export function getVisibleDualSyncFields(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  sections?: ReadonlyArray<DualSyncSectionKey>,
): ReadonlyArray<DualSyncFieldSummary> {
  if (!sections || sections.length === 0) {
    return fields.filter((field) => isDualSyncSectionKey(field.sectionKey));
  }
  const allowed = new Set<DualSyncSectionKey>(sections);
  return fields.filter((field) =>
    isDualSyncSectionKey(field.sectionKey) ? allowed.has(field.sectionKey) : false,
  );
}

export function groupDualSyncFieldsBySection(
  fields: ReadonlyArray<DualSyncFieldSummary>,
): Map<DualSyncSectionKey, DualSyncFieldSummary[]> {
  const grouped = new Map<DualSyncSectionKey, DualSyncFieldSummary[]>();
  for (const field of fields) {
    if (!isDualSyncSectionKey(field.sectionKey)) continue;
    const sectionFields = grouped.get(field.sectionKey) ?? [];
    sectionFields.push(field);
    grouped.set(field.sectionKey, sectionFields);
  }
  for (const sectionFields of grouped.values()) {
    sectionFields.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return grouped;
}

export function getOrderedDualSyncSectionKeys(
  fieldsBySection: ReadonlyMap<DualSyncSectionKey, ReadonlyArray<DualSyncFieldSummary>>,
): DualSyncSectionKey[] {
  return DUAL_SYNC_SECTION_ORDER.filter((key) => fieldsBySection.has(key));
}

export function getDualSyncAccordionValues(
  orderedSectionKeys: ReadonlyArray<DualSyncSectionKey>,
): string[] {
  return [
    ...orderedSectionKeys,
    DUAL_SYNC_PANEL_VALUES.metrics,
    DUAL_SYNC_PANEL_VALUES.pendingCandidates,
    DUAL_SYNC_PANEL_VALUES.queueJobs,
    DUAL_SYNC_PANEL_VALUES.publishes,
    DUAL_SYNC_PANEL_VALUES.operations,
  ];
}

export function resolveDualSyncOpenAccordionValue(
  current: string | undefined,
  orderedAccordionValues: ReadonlyArray<string>,
): string | undefined {
  if (current && orderedAccordionValues.includes(current)) {
    return current;
  }
  return orderedAccordionValues[0];
}
