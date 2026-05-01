import type { RestaurantBusinessContextMoreHoursType } from '@/services/ops/restaurants';

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
  'serviceAreas',
  'attributes',
  'serviceItems',
  'links',
];

export const EMBEDDED_DISCOVERY_PRIMARY_ORDER: FamilyKey[] = [
  'businessDetails',
  'categories',
  'attributes',
  'links',
];

export const EMBEDDED_DISCOVERY_MORE_ORDER: FamilyKey[] = ['serviceAreas', 'serviceItems'];

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
