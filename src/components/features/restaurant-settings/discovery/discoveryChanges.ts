import {
  AMENITY_ATTRIBUTE_KEYS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SECTION_TITLES,
  formatAttributeTitle,
  formatServiceAreaTitle,
  type AttributeEditor,
  type BusinessContextFamilyPayloadState,
  type BusinessDetailsEditor,
  type DirtyState,
  type FamilyKey,
} from '../businessContextModel';
import { getAmenityValueLabel } from './panels/attributesPanelDomain';
import { BUSINESS_DETAILS_STATUS_OPTIONS } from './panels/businessDetailsPanelDomain';
import { getLinkTypeLabel } from './panels/linksPanelDomain';

import type { SettingsChange, SettingsChangeGroup } from '../shared/SettingsReviewChangesDialog';

type Drafts = BusinessContextFamilyPayloadState;

function statusLabel(value: BusinessDetailsEditor['businessStatus']): string {
  return BUSINESS_DETAILS_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function businessDetailsChanges(saved: Drafts, draft: Drafts): SettingsChange[] {
  const before = saved.businessDetails;
  const after = draft.businessDetails;
  const changes: SettingsChange[] = [];
  if (before.businessStatus !== after.businessStatus) {
    changes.push({
      label: 'Business status',
      was: statusLabel(before.businessStatus),
      now: statusLabel(after.businessStatus),
    });
  }
  if (before.openingDate !== after.openingDate) {
    changes.push({
      label: 'Opening date',
      was: before.openingDate || 'Not set',
      now: after.openingDate || 'Not set',
    });
  }
  return changes;
}

/** The service-location switch is edited under Where you serve, so its change is listed there. */
function serviceLocationChanges(saved: Drafts, draft: Drafts): SettingsChange[] {
  const before = saved.businessDetails.isServiceAreaBusiness;
  const after = draft.businessDetails.isServiceAreaBusiness;
  return before === after
    ? []
    : [
        {
          label: 'We serve customers at their location',
          was: before ? 'Yes' : 'No',
          now: after ? 'Yes' : 'No',
        },
      ];
}

/** Added, removed and changed rows of one list section, matched by row id. */
export function diffDiscoveryRows<Row extends { id: string }>(
  before: readonly Row[],
  after: readonly Row[],
  name: (row: Row) => string,
  describe: (row: Row) => string,
): SettingsChange[] {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterIds = new Set(after.map((row) => row.id));
  const changes: SettingsChange[] = [];
  for (const row of after) {
    const previous = beforeById.get(row.id);
    if (!previous) {
      changes.push({ label: name(row), now: describe(row) });
    } else if (JSON.stringify(previous) !== JSON.stringify(row)) {
      const was = describe(previous);
      const now = describe(row);
      changes.push(
        was === now ? { label: name(row), now: 'Details changed' } : { label: name(row), was, now },
      );
    }
  }
  for (const row of before) {
    if (!afterIds.has(row.id)) {
      changes.push({ label: name(row), was: describe(row), now: 'Removed' });
    }
  }
  return changes;
}

function describeAttribute(row: AttributeEditor): string {
  return AMENITY_ATTRIBUTE_KEYS.has(row.attributeKey)
    ? getAmenityValueLabel(row.boolValue)
    : `${row.valueType || 'No value type'} · raw attribute data`;
}

const FAMILY_CHANGES: Record<FamilyKey, (saved: Drafts, draft: Drafts) => SettingsChange[]> = {
  businessDetails: businessDetailsChanges,
  categories: (saved, draft) =>
    diffDiscoveryRows(
      saved.categories.map(({ moreHoursTypeDraft: _typing, ...row }) => ({ ...row })),
      draft.categories.map(({ moreHoursTypeDraft: _typing, ...row }) => ({ ...row })),
      (row) => row.displayName.trim() || 'Unnamed category',
      (row) =>
        [
          row.displayName.trim() || 'Unnamed',
          row.isPrimary ? 'main' : null,
          row.categoryCode || null,
        ]
          .filter(Boolean)
          .join(' · '),
    ),
  links: (saved, draft) =>
    diffDiscoveryRows(
      saved.links,
      draft.links,
      (row) => row.label.trim() || getLinkTypeLabel(row.linkType) || 'Link',
      (row) =>
        [row.url || 'No web address', row.isPrimary ? 'main' : null].filter(Boolean).join(' · '),
    ),
  attributes: (saved, draft) =>
    diffDiscoveryRows(saved.attributes, draft.attributes, formatAttributeTitle, describeAttribute),
  serviceItems: (saved, draft) =>
    diffDiscoveryRows(
      saved.serviceItems,
      draft.serviceItems,
      (row) => row.displayName.trim() || row.itemKey.trim() || 'New service',
      (row) =>
        [row.displayName.trim() || 'No name', row.description.trim() || null]
          .filter(Boolean)
          .join(' · '),
    ),
  serviceAreas: (saved, draft) => [
    ...serviceLocationChanges(saved, draft),
    ...diffDiscoveryRows(saved.serviceAreas, draft.serviceAreas, formatServiceAreaTitle, (row) =>
      [formatServiceAreaTitle(row), row.areaType || null, row.regionCode || null]
        .filter(Boolean)
        .join(' · '),
    ),
  ],
};

/**
 * "Was → now" lines for the Review changes dialog, one group per section with changes. Pass the
 * page's display dirty state (`getDiscoveryDisplayDirtyState`) so the groups match the page.
 */
export function buildDiscoveryChangeGroups({
  saved,
  draft,
  dirty,
}: {
  saved: Drafts;
  draft: Drafts;
  dirty: DirtyState;
}): SettingsChangeGroup[] {
  return DISCOVERY_SECTION_ORDER.filter((family) => dirty[family]).map((family) => {
    const changes = FAMILY_CHANGES[family](saved, draft);
    return {
      id: family,
      title: DISCOVERY_SECTION_TITLES[family],
      // Reordering alone changes the saved list without changing any one row.
      changes: changes.length > 0 ? changes : [{ label: 'Order', now: 'Changed' }],
    };
  });
}
