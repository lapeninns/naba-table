import type {
  RestaurantBusinessContextAttribute,
  RestaurantBusinessContextBusinessDetails,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextLink,
  RestaurantBusinessContextMoreHoursType,
  RestaurantBusinessContextServiceArea,
  RestaurantBusinessContextServiceItem,
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
} from '@/services/ops/restaurants';

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

export const LINK_TYPE_OPTIONS = [
  { value: 'website', label: 'Website' },
  { value: 'menu_or_services', label: 'Menu / services' },
  { value: 'reservation', label: 'Reservation' },
  { value: 'order', label: 'Order' },
  { value: 'chat', label: 'Chat' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'Twitter / X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
] as const;

export const EDITABLE_LINK_TYPES = new Set(LINK_TYPE_OPTIONS.map((option) => option.value));

export type AmenityAttributeDefinition = {
  key: string;
  label: string;
};

export type AmenityAttributeGroup = {
  title: string;
  description: string;
  keys: AmenityAttributeDefinition[];
};

export const AMENITY_ATTRIBUTE_GROUPS: AmenityAttributeGroup[] = [
  {
    title: 'Accessibility',
    description: 'Access details guests often check before visiting.',
    keys: [
      { key: 'has_wheelchair_accessible_entrance', label: 'Wheelchair-accessible entrance' },
      { key: 'has_wheelchair_accessible_restroom', label: 'Wheelchair-accessible toilet' },
      { key: 'has_wheelchair_accessible_parking', label: 'Wheelchair-accessible car park' },
    ],
  },
  {
    title: 'Amenities & crowd',
    description: 'Facilities and welcome signals for guests.',
    keys: [
      { key: 'has_restroom', label: 'Has toilet' },
      { key: 'has_wifi', label: 'Free Wi-Fi' },
      { key: 'good_for_kids', label: 'Good for kids' },
      { key: 'lgbtq_friendly', label: 'LGBTQ+ friendly' },
    ],
  },
  {
    title: 'Dining options',
    description: 'How guests can eat or spend time at the venue.',
    keys: [
      { key: 'seating', label: 'Has seating' },
      { key: 'outdoor_seating', label: 'Has outdoor seating' },
      { key: 'table_service', label: 'Has table service' },
      { key: 'dine_in', label: 'Serves dine-in' },
    ],
  },
  {
    title: 'Highlights',
    description: 'Reasons guests may choose this venue.',
    keys: [
      { key: 'live_performances', label: 'Live performances' },
      { key: 'watching_sport', label: 'Good for watching sport' },
      { key: 'live_music', label: 'Live music' },
      { key: 'karaoke', label: 'Karaoke' },
      { key: 'bar_games', label: 'Has bar games' },
      { key: 'rooftop_seating', label: 'Rooftop seating' },
    ],
  },
  {
    title: 'Offerings',
    description: 'Food and drink options guests can expect.',
    keys: [
      { key: 'serves_spirits', label: 'Serves spirits' },
      { key: 'serves_beer', label: 'Serves beer' },
      { key: 'serves_food', label: 'Serves food' },
      { key: 'serves_alcohol', label: 'Serves alcohol' },
      { key: 'serves_food_at_bar', label: 'Serves food at bar' },
      { key: 'serves_wine', label: 'Serves wine' },
      { key: 'serves_cocktails', label: 'Serves cocktails' },
      { key: 'happy_hour_drinks', label: 'Happy-hour drinks' },
      { key: 'happy_hour_food', label: 'Happy-hour food' },
    ],
  },
  {
    title: 'Parking',
    description: 'Parking options around the venue.',
    keys: [
      { key: 'free_parking_lot', label: 'Free parking lot' },
      { key: 'free_street_parking', label: 'Free street parking' },
      { key: 'paid_parking_lot', label: 'Paid parking lot' },
    ],
  },
  {
    title: 'Payments',
    description: 'Payment methods accepted on site.',
    keys: [
      { key: 'accepts_debit_cards', label: 'Accepts debit cards' },
      { key: 'nfc_mobile_payments', label: 'NFC mobile payments' },
      { key: 'accepts_credit_cards', label: 'Accepts credit cards' },
      { key: 'cash_only', label: 'Cash-only' },
      { key: 'accepts_visa', label: 'Visa' },
      { key: 'accepts_amex', label: 'American Express' },
      { key: 'accepts_mastercard', label: 'Mastercard' },
    ],
  },
  {
    title: 'Service options & planning',
    description: 'Booking and fulfilment details for guests.',
    keys: [
      { key: 'dogs_allowed', label: 'Dogs allowed' },
      { key: 'reservations_required', label: 'Reservations required' },
      { key: 'reservations', label: 'Accepts reservations' },
      { key: 'delivery', label: 'Delivery' },
      { key: 'takeout', label: 'Offers takeaway' },
      { key: 'drive_through', label: 'Drive-through' },
      { key: 'no_contact_delivery', label: 'No-contact delivery' },
    ],
  },
];

export const AMENITY_ATTRIBUTE_KEYS = new Set(
  AMENITY_ATTRIBUTE_GROUPS.flatMap((group) => group.keys.map((item) => item.key)),
);

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

export function toPrettyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) && value.length === 0) {
    return '';
  }
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

export function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

export function serializeMoreHoursTypes(
  rows: RestaurantBusinessContextMoreHoursType[],
): RestaurantBusinessContextMoreHoursType[] {
  return rows
    .map((row) => ({
      hoursTypeId: row.hoursTypeId?.trim() || null,
      displayName: row.displayName?.trim() || null,
      localizedDisplayName: row.localizedDisplayName?.trim() || null,
    }))
    .filter(
      (row) =>
        row.hoursTypeId !== null || row.displayName !== null || row.localizedDisplayName !== null,
    );
}

export function parseJsonRecord(value: string, label: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be valid JSON object syntax.`);
  }
}

export function parseJsonArray<T>(value: string, label: string): T[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed as T[];
  } catch {
    throw new Error(`${label} must be valid JSON array syntax.`);
  }
}

export function cloneFamily<T>(
  core: T[],
  provider: T[],
): { rows: T[]; source: SeedSource[FamilyKey] } {
  if (core.length > 0) {
    return { rows: core, source: 'core' };
  }
  if (provider.length > 0) {
    return { rows: provider, source: 'provider' };
  }
  return { rows: [], source: 'empty' };
}

export function isEditableLinkType(
  linkType: string,
): linkType is (typeof LINK_TYPE_OPTIONS)[number]['value'] {
  return EDITABLE_LINK_TYPES.has(linkType as (typeof LINK_TYPE_OPTIONS)[number]['value']);
}

export function filterEditableLinks(
  input: RestaurantBusinessContextLink[] | null | undefined,
): RestaurantBusinessContextLink[] {
  return (input ?? []).filter((row) => isEditableLinkType(row.linkType));
}

export function toCategoryEditors(input: RestaurantBusinessContextCategory[]): CategoryEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    categoryCode: row.categoryCode ?? '',
    isPrimary: row.isPrimary,
    moreHoursTypes: row.moreHoursTypes.map((moreHoursType) => ({
      hoursTypeId: moreHoursType.hoursTypeId,
      displayName: moreHoursType.displayName,
      localizedDisplayName: moreHoursType.localizedDisplayName,
    })),
    moreHoursTypeDraft: '',
  }));
}

export function toServiceAreaEditors(
  input: RestaurantBusinessContextServiceArea[],
): ServiceAreaEditor[] {
  return input.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    areaType: row.areaType,
    regionCode: row.regionCode ?? '',
    googlePlaceId: row.googlePlaceId ?? '',
    googlePlaceResourceName: row.googlePlaceResourceName ?? '',
    placeDataJson: toPrettyJson(row.placeData),
  }));
}

export function toAttributeEditors(input: RestaurantBusinessContextAttribute[]): AttributeEditor[] {
  return input.map((row) => ({
    id: row.id,
    attributeGroup: row.attributeGroup ?? '',
    attributeKey: row.attributeKey,
    attributeName: row.attributeName ?? '',
    attributeId: row.attributeId ?? '',
    displayName: row.displayName ?? '',
    displayText: row.displayText ?? '',
    displayTextStandalone: row.displayTextStandalone ?? '',
    displayTextNegative: row.displayTextNegative ?? '',
    valueType: row.valueType,
    boolValue: row.boolValue === true ? 'true' : row.boolValue === false ? 'false' : 'unset',
    textValue: row.textValue ?? '',
    uriValue: row.uriValue ?? '',
    uriValuesText: row.uriValues.join(', '),
    enumValuesText: row.enumValues.join(', '),
    unsetEnumValuesText: row.unsetEnumValues.join(', '),
    rawValueJson: toPrettyJson(row.rawValue),
    rawEnumValuesJson: toPrettyJson(row.rawEnumValues),
    displayValueJson: toPrettyJson(row.displayValue),
    valueMetadataJson: toPrettyJson(row.valueMetadata),
  }));
}

export function toServiceItemEditors(
  input: RestaurantBusinessContextServiceItem[],
): ServiceItemEditor[] {
  return input.map((row) => ({
    id: row.id,
    itemKey: row.itemKey,
    itemType: row.itemType ?? '',
    displayName: row.displayName ?? '',
    description: row.description ?? '',
    payloadJson: toPrettyJson(row.payload),
  }));
}

export function toBusinessDetailsEditor(
  input: RestaurantBusinessContextBusinessDetails | null | undefined,
): BusinessDetailsEditor {
  if (!input) {
    return EMPTY_BUSINESS_DETAILS;
  }

  return {
    openingDate: input.openingDate ?? '',
    businessStatus:
      input.businessStatus === 'open' ||
      input.businessStatus === 'closed_permanently' ||
      input.businessStatus === 'closed_temporarily'
        ? input.businessStatus
        : 'unset',
    isServiceAreaBusiness: input.isServiceAreaBusiness,
  };
}

export function toLinkEditors(input: RestaurantBusinessContextLink[]): LinkEditor[] {
  return filterEditableLinks(input).map((row) => ({
    id: row.id,
    linkType: row.linkType,
    label: row.label ?? '',
    url: row.url,
    isPrimary: row.isPrimary,
  }));
}

export function deriveFamilyCounts(family: RestaurantBusinessContextFamily | null | undefined) {
  return {
    businessDetails: family?.businessDetails ? 1 : 0,
    links: filterEditableLinks(family?.links).length,
    categories: family?.categories.length ?? 0,
    serviceAreas: family?.serviceAreas.length ?? 0,
    attributes: family?.attributes.length ?? 0,
    serviceItems: family?.serviceItems.length ?? 0,
  } satisfies FamilyCounts;
}

export function deriveBusinessContextEditorState(
  snapshot: RestaurantBusinessContextSnapshot,
): BusinessContextEditorState {
  const nextCategories = cloneFamily(
    snapshot.core.categories,
    snapshot.providerSnapshot.categories,
  );
  const nextBusinessDetailsSource = snapshot.core.businessDetails
    ? 'core'
    : snapshot.providerSnapshot.businessDetails
      ? 'provider'
      : 'empty';
  const nextLinks = cloneFamily(
    filterEditableLinks(snapshot.core.links),
    filterEditableLinks(snapshot.providerSnapshot.links),
  );
  const nextServiceAreas = cloneFamily(
    snapshot.core.serviceAreas,
    snapshot.providerSnapshot.serviceAreas,
  );
  const nextAttributes = cloneFamily(
    snapshot.core.attributes,
    snapshot.providerSnapshot.attributes,
  );
  const nextServiceItems = cloneFamily(
    snapshot.core.serviceItems,
    snapshot.providerSnapshot.serviceItems,
  );

  return {
    businessDetails: toBusinessDetailsEditor(
      snapshot.core.businessDetails ?? snapshot.providerSnapshot.businessDetails,
    ),
    links: toLinkEditors(nextLinks.rows),
    categories: toCategoryEditors(nextCategories.rows),
    serviceAreas: toServiceAreaEditors(nextServiceAreas.rows),
    serviceAreaDraft: '',
    attributes: toAttributeEditors(nextAttributes.rows),
    serviceItems: toServiceItemEditors(nextServiceItems.rows),
    seedSource: {
      businessDetails: nextBusinessDetailsSource,
      links: nextLinks.source,
      categories: nextCategories.source,
      serviceAreas: nextServiceAreas.source,
      attributes: nextAttributes.source,
      serviceItems: nextServiceItems.source,
    },
  };
}

export function deriveBusinessContextFamilyState(
  snapshot: RestaurantBusinessContextSnapshot,
  family: FamilyKey,
): Partial<BusinessContextEditorState> {
  const next = deriveBusinessContextEditorState(snapshot);

  if (family === 'businessDetails') {
    return {
      businessDetails: next.businessDetails,
      seedSource: { ...EMPTY_SEED_SOURCE, businessDetails: next.seedSource.businessDetails },
    };
  }

  if (family === 'links') {
    return {
      links: next.links,
      seedSource: { ...EMPTY_SEED_SOURCE, links: next.seedSource.links },
    };
  }

  if (family === 'categories') {
    return {
      categories: next.categories,
      seedSource: { ...EMPTY_SEED_SOURCE, categories: next.seedSource.categories },
    };
  }

  if (family === 'serviceAreas') {
    return {
      serviceAreas: next.serviceAreas,
      serviceAreaDraft: '',
      seedSource: { ...EMPTY_SEED_SOURCE, serviceAreas: next.seedSource.serviceAreas },
    };
  }

  if (family === 'attributes') {
    return {
      attributes: next.attributes,
      seedSource: { ...EMPTY_SEED_SOURCE, attributes: next.seedSource.attributes },
    };
  }

  return {
    serviceItems: next.serviceItems,
    seedSource: { ...EMPTY_SEED_SOURCE, serviceItems: next.seedSource.serviceItems },
  };
}

export function buildBusinessContextFamilyPayload(
  family: FamilyKey,
  state: BusinessContextFamilyPayloadState,
): UpdateRestaurantBusinessContextInput {
  if (family === 'businessDetails') {
    return {
      businessDetails: {
        openingDate: state.businessDetails.openingDate.trim() || null,
        businessStatus:
          state.businessDetails.businessStatus === 'unset'
            ? null
            : state.businessDetails.businessStatus,
        isServiceAreaBusiness: state.businessDetails.isServiceAreaBusiness,
      },
    };
  }

  if (family === 'links') {
    return {
      links: state.links.map((row) => ({
        id: row.id.startsWith('link-') ? undefined : row.id,
        linkType: row.linkType.trim(),
        linkStatus: 'current',
        label: row.label.trim() || null,
        url: row.url.trim(),
        isPrimary: row.isPrimary,
      })),
    };
  }

  if (family === 'categories') {
    const primaryCount = state.categories.filter((row) => row.isPrimary).length;
    if (primaryCount > 1) {
      throw new Error('Only one category can be marked as primary.');
    }

    return {
      categories: state.categories.map((row) => ({
        id: row.id.startsWith('category-') ? undefined : row.id,
        displayName: row.displayName.trim(),
        categoryCode: row.categoryCode.trim() || null,
        isPrimary: row.isPrimary,
        moreHoursTypes: serializeMoreHoursTypes(row.moreHoursTypes),
      })),
    };
  }

  if (family === 'serviceAreas') {
    return {
      serviceAreas: state.serviceAreas.map((row) => ({
        id: row.id.startsWith('service-area-') ? undefined : row.id,
        displayName: row.displayName.trim(),
        areaType: row.areaType.trim() || 'region',
        regionCode: row.regionCode.trim() || null,
        googlePlaceId: row.googlePlaceId.trim() || null,
        googlePlaceResourceName: row.googlePlaceResourceName.trim() || null,
        placeData: parseJsonRecord(row.placeDataJson, 'Place data'),
      })),
    };
  }

  if (family === 'attributes') {
    return {
      attributes: state.attributes.map((row) => ({
        id: row.id.startsWith('attribute-') ? undefined : row.id,
        attributeGroup: row.attributeGroup.trim() || null,
        attributeKey: row.attributeKey.trim(),
        attributeName: row.attributeName.trim() || null,
        attributeId: row.attributeId.trim() || null,
        displayName: row.displayName.trim() || null,
        displayText: row.displayText.trim() || null,
        displayTextStandalone: row.displayTextStandalone.trim() || null,
        displayTextNegative: row.displayTextNegative.trim() || null,
        valueType: row.valueType.trim(),
        boolValue: row.boolValue === 'unset' ? null : row.boolValue === 'true',
        textValue: row.textValue.trim() || null,
        uriValue: row.uriValue.trim() || null,
        uriValues: csvToArray(row.uriValuesText),
        enumValues: csvToArray(row.enumValuesText),
        unsetEnumValues: csvToArray(row.unsetEnumValuesText),
        rawValue: parseJsonRecord(row.rawValueJson, 'Raw value'),
        rawEnumValues: parseJsonRecord(row.rawEnumValuesJson, 'Raw enum values'),
        displayValue: parseJsonRecord(row.displayValueJson, 'Display value'),
        valueMetadata: parseJsonArray(row.valueMetadataJson, 'Value metadata'),
      })),
    };
  }

  return {
    serviceItems: state.serviceItems.map((row) => ({
      id: row.id.startsWith('service-item-') ? undefined : row.id,
      itemKey: row.itemKey.trim(),
      itemType: row.itemType.trim() || null,
      displayName: row.displayName.trim() || null,
      description: row.description.trim() || null,
      payload: parseJsonRecord(row.payloadJson, 'Payload'),
    })),
  };
}
