import type { ReadinessItemKey } from '../restaurantProfileModel';
import type { ProfileSectionId } from './profileSections';

export const READINESS_FIELD_TARGETS: Partial<
  Record<ReadinessItemKey, { sectionId: ProfileSectionId; fieldId: string }>
> = {
  name: { sectionId: 'brand', fieldId: 'restaurant-name' },
  description: { sectionId: 'brand', fieldId: 'restaurant-business-description' },
  bookingUrl: { sectionId: 'advanced', fieldId: 'restaurant-slug' },
  contactPhone: { sectionId: 'contact', fieldId: 'restaurant-phone' },
  contactEmail: { sectionId: 'contact', fieldId: 'restaurant-email' },
  address: { sectionId: 'contact', fieldId: 'restaurant-address' },
  timezone: { sectionId: 'contact', fieldId: 'restaurant-timezone' },
  mapUrl: { sectionId: 'contact', fieldId: 'restaurant-google-map' },
  logo: { sectionId: 'brand', fieldId: 'restaurant-logo-uploader' },
};
