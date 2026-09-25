import type { ReadinessItemKey } from '../restaurantProfileModel';

/** The control each readiness "Add" link scrolls to and focuses. */
export const READINESS_FIELD_TARGETS: Record<ReadinessItemKey, string> = {
  name: 'restaurant-name',
  description: 'restaurant-business-description',
  bookingUrl: 'restaurant-slug',
  contactPhone: 'restaurant-phone',
  contactEmail: 'restaurant-email',
  address: 'restaurant-address',
  timezone: 'restaurant-timezone',
  mapUrl: 'restaurant-google-map',
  logo: 'restaurant-logo-upload',
};
