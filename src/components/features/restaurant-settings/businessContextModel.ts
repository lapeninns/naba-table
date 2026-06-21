import {
  AMENITY_ATTRIBUTE_GROUPS as GBP_AMENITY_ATTRIBUTE_GROUPS,
  AMENITY_ATTRIBUTE_KEYS as GBP_AMENITY_ATTRIBUTE_KEYS,
  type AmenityAttributeDefinition,
  type AmenityAttributeGroup,
} from '@/lib/google-business-profile/amenity-catalog';
import {
  RESTAURANT_EDITABLE_LINK_TYPES,
  RESTAURANT_LINK_TYPE_OPTIONS,
  type RestaurantEditableLinkType,
} from '@/lib/ops/restaurant-link-types';

import type { RestaurantBusinessContextMoreHoursType } from '@/services/ops/restaurants';

export type { AmenityAttributeDefinition, AmenityAttributeGroup };
export {
  buildBusinessContextFamilyPayload,
  csvToArray,
  parseJsonArray,
  parseJsonRecord,
  serializeMoreHoursTypes,
} from './businessContextPayload';
export {
  cloneFamily,
  deriveBusinessContextEditorState,
  deriveBusinessContextFamilyState,
  deriveFamilyCounts,
  filterEditableLinks,
  isEditableLinkType,
  toAttributeEditors,
  toBusinessDetailsEditor,
  toCategoryEditors,
  toLinkEditors,
  toPrettyJson,
  toServiceAreaEditors,
  toServiceItemEditors,
} from './businessContextEditorState';

export type FamilyKey =
  | 'businessDetails'
  | 'links'
  | 'categories'
  | 'serviceAreas'
  | 'attributes'
  | 'serviceItems';

export type SeedSource = Record<FamilyKey, 'core' | 'provider' | 'empty'>;
export type DirtyState = Record<FamilyKey, boolean>;
export type ErrorState = Partial<Record<FamilyKey, string | null>>;

export type FamilyCounts = Record<FamilyKey, number>;

export type BusinessDetailsEditor = {
  openingDate: string;
  businessStatus: 'unset' | 'open' | 'closed_permanently' | 'closed_temporarily';
  isServiceAreaBusiness: boolean;
};

export type LinkEditor = {
  id: string;
  linkType: string;
  label: string;
  url: string;
  isPrimary: boolean;
};

export type CategoryEditor = {
  id: string;
  displayName: string;
  categoryCode: string;
  isPrimary: boolean;
  moreHoursTypes: RestaurantBusinessContextMoreHoursType[];
  moreHoursTypeDraft: string;
};

export type ServiceAreaEditor = {
  id: string;
  displayName: string;
  areaType: string;
  regionCode: string;
  googlePlaceId: string;
  googlePlaceResourceName: string;
  placeDataJson: string;
};

export type AttributeEditor = {
  id: string;
  attributeGroup: string;
  attributeKey: string;
  attributeName: string;
  attributeId: string;
  displayName: string;
  displayText: string;
  displayTextStandalone: string;
  displayTextNegative: string;
  valueType: string;
  boolValue: 'unset' | 'true' | 'false';
  textValue: string;
  uriValue: string;
  uriValuesText: string;
  enumValuesText: string;
  unsetEnumValuesText: string;
  rawValueJson: string;
  rawEnumValuesJson: string;
  displayValueJson: string;
  valueMetadataJson: string;
};

export type ServiceItemEditor = {
  id: string;
  itemKey: string;
  itemType: string;
  displayName: string;
  description: string;
  payloadJson: string;
};

export type BusinessContextEditorState = {
  businessDetails: BusinessDetailsEditor;
  links: LinkEditor[];
  categories: CategoryEditor[];
  serviceAreas: ServiceAreaEditor[];
  serviceAreaDraft: string;
  attributes: AttributeEditor[];
  serviceItems: ServiceItemEditor[];
  seedSource: SeedSource;
};

export type BusinessContextFamilyPayloadState = Pick<
  BusinessContextEditorState,
  'businessDetails' | 'links' | 'categories' | 'serviceAreas' | 'attributes' | 'serviceItems'
>;

export const TAB_LABELS: Record<FamilyKey, string> = {
  businessDetails: 'Profile basics',
  links: 'Online links',
  categories: 'Dining categories',
  serviceAreas: 'Where you serve',
  attributes: 'Amenities',
  serviceItems: 'Services',
};

export const DISCOVERY_SECTION_ORDER: FamilyKey[] = [
  'businessDetails',
  'categories',
  'links',
  'attributes',
  'serviceItems',
  'serviceAreas',
];

export const DISCOVERY_SECTION_DESCRIPTIONS: Record<FamilyKey, string> = {
  businessDetails: 'Opening status and whether this restaurant also serves guests off-site.',
  categories: 'The main dining categories guests and profile providers use to describe the venue.',
  serviceAreas: 'Places or regions this restaurant serves beyond the venue.',
  attributes: 'Useful amenities and profile facts guests may care about.',
  serviceItems: 'Services or offers that help describe what the restaurant provides.',
  links: 'Website, menu, reservation, ordering, chat, and social links guests may use.',
};

export const SYNC_POSTURE: Record<FamilyKey, string> = {
  businessDetails: 'These basics support public profile checks and guest-facing listings.',
  links: 'Use these links on public profiles, menus, ordering journeys, and customer messages.',
  categories: 'Categories help guests and profile providers understand what the restaurant offers.',
  serviceAreas: 'Add areas only when the restaurant serves guests beyond the venue.',
  attributes:
    'Use amenities to capture helpful profile details such as accessibility or facilities.',
  serviceItems: 'Use services to describe optional offers beyond the standard reservation flow.',
};

export const LINK_TYPE_OPTIONS = RESTAURANT_LINK_TYPE_OPTIONS;
export const EDITABLE_LINK_TYPES = new Set<RestaurantEditableLinkType>(
  RESTAURANT_EDITABLE_LINK_TYPES,
);
export const AMENITY_ATTRIBUTE_GROUPS = GBP_AMENITY_ATTRIBUTE_GROUPS;
export const AMENITY_ATTRIBUTE_KEYS = GBP_AMENITY_ATTRIBUTE_KEYS;

export const EMPTY_BUSINESS_DETAILS: BusinessDetailsEditor = {
  openingDate: '',
  businessStatus: 'unset',
  isServiceAreaBusiness: false,
};

export const EMPTY_SEED_SOURCE: SeedSource = {
  businessDetails: 'empty',
  links: 'empty',
  categories: 'empty',
  serviceAreas: 'empty',
  attributes: 'empty',
  serviceItems: 'empty',
};

export const EMPTY_DIRTY_STATE: DirtyState = {
  businessDetails: false,
  links: false,
  categories: false,
  serviceAreas: false,
  attributes: false,
  serviceItems: false,
};

export function makeEditorId(prefix: string): string {
  const native = globalThis.crypto?.randomUUID?.();
  return native ? `${prefix}-${native}` : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeFieldId(family: FamilyKey, rowId: string, field: string): string {
  return `${family}-${rowId}-${field}`;
}

export function formatSeedSource(value: SeedSource[FamilyKey], providerCount: number): string {
  if (value === 'core') {
    return 'Showing saved values';
  }
  if (value === 'provider' && providerCount > 0) {
    return 'Pre-filled from Google until you save';
  }
  return 'No values yet';
}

export function splitChipDraft(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCategoryTitle(row: CategoryEditor): string {
  const displayName = row.displayName.trim();
  if (displayName) {
    return displayName;
  }
  return row.isPrimary ? 'Primary category' : 'New category';
}

export function humanizeAttributeKey(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatAttributeTitle(row: AttributeEditor): string {
  return row.displayName.trim() || humanizeAttributeKey(row.attributeKey) || 'New attribute';
}

export function formatServiceAreaTitle(row: ServiceAreaEditor): string {
  return row.displayName.trim() || 'New service area';
}

export function formatMoreHoursTypeLabel(row: RestaurantBusinessContextMoreHoursType): string {
  return (
    row.hoursTypeId?.trim() || row.localizedDisplayName?.trim() || row.displayName?.trim() || ''
  );
}
