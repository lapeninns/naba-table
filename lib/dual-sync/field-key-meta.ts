import type { DualSyncSectionKey } from '@/server/dual-sync';

export const GBP_COMPARABLE_SECTION_KEYS: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
] as const;

export const PROFILE_FIELD_LABELS = {
  'profile.name': 'Business name',
  'profile.businessDescription': 'Business description',
  'profile.contactPhone': 'Contact phone',
  'profile.address': 'Address',
  'profile.googleMapUrl': 'Google Maps URL',
  'profile.googleReviewUrl': 'Google review URL',
} as const;

export const OPERATING_HOURS_FIELD_LABELS = {
  'operatingHours.weekly.0': 'Sunday hours',
  'operatingHours.weekly.1': 'Monday hours',
  'operatingHours.weekly.2': 'Tuesday hours',
  'operatingHours.weekly.3': 'Wednesday hours',
  'operatingHours.weekly.4': 'Thursday hours',
  'operatingHours.weekly.5': 'Friday hours',
  'operatingHours.weekly.6': 'Saturday hours',
} as const;

const GBP_COMPARABLE_SECTION_SET = new Set<string>(GBP_COMPARABLE_SECTION_KEYS);

export function isGbpComparableSection(
  sectionKey: string | null | undefined,
): sectionKey is DualSyncSectionKey {
  return Boolean(sectionKey && GBP_COMPARABLE_SECTION_SET.has(sectionKey));
}

export function getProfileFieldKey(fieldName: string): keyof typeof PROFILE_FIELD_LABELS | null {
  switch (fieldName) {
    case 'name':
      return 'profile.name';
    case 'businessDescription':
      return 'profile.businessDescription';
    case 'contactPhone':
      return 'profile.contactPhone';
    case 'address':
      return 'profile.address';
    case 'googleMapUrl':
      return 'profile.googleMapUrl';
    case 'googleReviewUrl':
      return 'profile.googleReviewUrl';
    default:
      return null;
  }
}
