import { z } from 'zod';

import { RESTAURANT_EDITABLE_LINK_TYPES } from '@/lib/ops/restaurant-link-types';

import {
  DISCOVERY_SECTION_ORDER,
  makeFieldId,
  type BusinessContextFamilyPayloadState,
  type DirtyState,
  type FamilyKey,
} from '../businessContextModel';

/**
 * A blocking problem in the Discovery draft. Every rule restates a rule the business-context API
 * already enforces, so staff see it next to the field instead of as a failed save.
 */
export type DiscoveryIssue = {
  family: FamilyKey;
  /** DOM id of the field to focus for "Show first issue". */
  fieldId: string;
  message: string;
  /** Collapsed disclosures (outermost first) that must open for the field to be visible. */
  disclosures: readonly string[];
};

export const DISCOVERY_DISCLOSURE_IDS = {
  categoryAdvanced: 'discovery-categories-advanced',
  amenitiesRaw: 'discovery-amenities-raw',
  serviceAreasAdvanced: 'discovery-service-areas-advanced',
  amenityGroup: (index: number) => `discovery-amenity-group-${index}`,
  attributePayload: (rowId: string) => `discovery-attribute-${rowId}-payload`,
  serviceItemAdvanced: (rowId: string) => `discovery-service-${rowId}-advanced`,
  serviceAreaPayload: (rowId: string) => `discovery-service-area-${rowId}-payload`,
} as const;

/** Field ids that are not per-row. */
export const DISCOVERY_FIELD_IDS = {
  newCategory: 'discovery-new-category',
  newServiceArea: 'discovery-new-service-area',
  addLink: 'discovery-add-link',
  addService: 'discovery-add-service',
  addAttribute: 'discovery-add-attribute',
  categoryMakeMain: (rowId: string) => `discovery-category-${rowId}-make-main`,
} as const;

const LINK_URL_SCHEMA = z.string().trim().url();
const EDITABLE_LINK_TYPES = new Set<string>(RESTAURANT_EDITABLE_LINK_TYPES);
const SERVICE_AREA_TYPES = new Set(['place', 'region', 'postal_code', 'other']);
const ATTRIBUTE_VALUE_TYPES = new Set(['boolean', 'text', 'uri', 'enum', 'multienum']);
const ATTRIBUTE_VALUE_TYPE_ALIASES: Record<string, string> = {
  bool: 'boolean',
  string: 'text',
  url: 'uri',
  multi_enum: 'multienum',
  repeated_enum: 'multienum',
};

function isJsonObjectOrBlank(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function isJsonArrayOrBlank(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  try {
    return Array.isArray(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

export function isValidAttributeValueType(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ATTRIBUTE_VALUE_TYPES.has(ATTRIBUTE_VALUE_TYPE_ALIASES[normalized] ?? normalized);
}

function linkIssues(state: BusinessContextFamilyPayloadState): DiscoveryIssue[] {
  return state.links.flatMap((row): DiscoveryIssue[] => {
    const issues: DiscoveryIssue[] = [];
    if (!EDITABLE_LINK_TYPES.has(row.linkType)) {
      issues.push({
        family: 'links',
        fieldId: makeFieldId('links', row.id, 'linkType'),
        message: 'Choose a link type.',
        disclosures: [],
      });
    }
    if (!LINK_URL_SCHEMA.safeParse(row.url).success) {
      issues.push({
        family: 'links',
        fieldId: makeFieldId('links', row.id, 'url'),
        message: 'Enter a full web address, starting with https://',
        disclosures: [],
      });
    }
    return issues;
  });
}

function categoryIssues(state: BusinessContextFamilyPayloadState): DiscoveryIssue[] {
  const issues: DiscoveryIssue[] = state.categories
    .filter((row) => !row.displayName.trim())
    .map((row) => ({
      family: 'categories',
      fieldId: makeFieldId('categories', row.id, 'displayName'),
      message: 'Every category needs a name.',
      disclosures: [DISCOVERY_DISCLOSURE_IDS.categoryAdvanced],
    }));
  const primaries = state.categories.filter((row) => row.isPrimary);
  if (primaries.length > 1 && primaries[0]) {
    issues.push({
      family: 'categories',
      fieldId: DISCOVERY_FIELD_IDS.categoryMakeMain(primaries[0].id),
      message: 'Only one category can be the main one. Choose Make main on the one you want.',
      disclosures: [],
    });
  }
  return issues;
}

function serviceAreaIssues(state: BusinessContextFamilyPayloadState): DiscoveryIssue[] {
  return state.serviceAreas.flatMap((row): DiscoveryIssue[] => {
    const issues: DiscoveryIssue[] = [];
    const advanced = [DISCOVERY_DISCLOSURE_IDS.serviceAreasAdvanced];
    if (!row.displayName.trim()) {
      issues.push({
        family: 'serviceAreas',
        fieldId: makeFieldId('serviceAreas', row.id, 'displayName'),
        message: 'Every area needs a name.',
        disclosures: advanced,
      });
    }
    const areaType = row.areaType.trim().toLowerCase();
    if (areaType && !SERVICE_AREA_TYPES.has(areaType)) {
      issues.push({
        family: 'serviceAreas',
        fieldId: makeFieldId('serviceAreas', row.id, 'areaType'),
        message: 'Area type must be place, region, postal_code or other.',
        disclosures: advanced,
      });
    }
    if (!isJsonObjectOrBlank(row.placeDataJson)) {
      issues.push({
        family: 'serviceAreas',
        fieldId: makeFieldId('serviceAreas', row.id, 'placeDataJson'),
        message: 'Place data must be a valid JSON object.',
        disclosures: [...advanced, DISCOVERY_DISCLOSURE_IDS.serviceAreaPayload(row.id)],
      });
    }
    return issues;
  });
}

const ATTRIBUTE_JSON_OBJECT_FIELDS = [
  ['rawValueJson', 'Raw value'],
  ['rawEnumValuesJson', 'Raw selected values'],
  ['displayValueJson', 'Display value'],
] as const;

function attributeIssues(state: BusinessContextFamilyPayloadState): DiscoveryIssue[] {
  return state.attributes.flatMap((row): DiscoveryIssue[] => {
    const issues: DiscoveryIssue[] = [];
    const raw = [DISCOVERY_DISCLOSURE_IDS.amenitiesRaw];
    if (!row.attributeKey.trim()) {
      issues.push({
        family: 'attributes',
        fieldId: makeFieldId('attributes', row.id, 'attributeKey'),
        message: 'Enter the attribute key.',
        disclosures: raw,
      });
    }
    if (!isValidAttributeValueType(row.valueType)) {
      issues.push({
        family: 'attributes',
        fieldId: makeFieldId('attributes', row.id, 'valueType'),
        message: 'Value type must be boolean, text, uri, enum or multienum.',
        disclosures: raw,
      });
    }
    if (!isJsonArrayOrBlank(row.valueMetadataJson)) {
      issues.push({
        family: 'attributes',
        fieldId: makeFieldId('attributes', row.id, 'valueMetadataJson'),
        message: 'Value details must be a valid JSON array.',
        disclosures: raw,
      });
    }
    for (const [field, label] of ATTRIBUTE_JSON_OBJECT_FIELDS) {
      if (!isJsonObjectOrBlank(row[field])) {
        issues.push({
          family: 'attributes',
          fieldId: makeFieldId('attributes', row.id, field),
          message: `${label} must be a valid JSON object.`,
          disclosures: [...raw, DISCOVERY_DISCLOSURE_IDS.attributePayload(row.id)],
        });
      }
    }
    return issues;
  });
}

function serviceItemIssues(state: BusinessContextFamilyPayloadState): DiscoveryIssue[] {
  return state.serviceItems.flatMap((row): DiscoveryIssue[] => {
    const issues: DiscoveryIssue[] = [];
    const advanced = [DISCOVERY_DISCLOSURE_IDS.serviceItemAdvanced(row.id)];
    if (!row.itemKey.trim()) {
      issues.push({
        family: 'serviceItems',
        fieldId: makeFieldId('serviceItems', row.id, 'itemKey'),
        message: 'Enter a service code. Each service needs one.',
        disclosures: advanced,
      });
    }
    if (!isJsonObjectOrBlank(row.payloadJson)) {
      issues.push({
        family: 'serviceItems',
        fieldId: makeFieldId('serviceItems', row.id, 'payloadJson'),
        message: 'Service details must be a valid JSON object.',
        disclosures: advanced,
      });
    }
    return issues;
  });
}

const ISSUE_COLLECTORS: Record<
  FamilyKey,
  (state: BusinessContextFamilyPayloadState) => DiscoveryIssue[]
> = {
  businessDetails: () => [],
  categories: categoryIssues,
  links: linkIssues,
  attributes: attributeIssues,
  serviceItems: serviceItemIssues,
  serviceAreas: serviceAreaIssues,
};

/**
 * Issues in the sections that would be saved, in page order. Clean sections are not sent, so
 * they never block a save.
 */
export function collectDiscoveryIssues(
  state: BusinessContextFamilyPayloadState,
  dirty: DirtyState,
): DiscoveryIssue[] {
  return DISCOVERY_SECTION_ORDER.filter((family) => dirty[family]).flatMap((family) =>
    ISSUE_COLLECTORS[family](state),
  );
}

export function countDiscoveryIssuesByFamily(
  issues: readonly DiscoveryIssue[],
): Record<FamilyKey, number> {
  const counts = Object.fromEntries(DISCOVERY_SECTION_ORDER.map((family) => [family, 0])) as Record<
    FamilyKey,
    number
  >;
  for (const issue of issues) {
    counts[issue.family] += 1;
  }
  return counts;
}
