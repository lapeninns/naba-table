import {
  COMMON_TIMEZONES,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { RestaurantProfile } from '@/services/ops/restaurants';

/**
 * Default values used to seed the shared `RestaurantDetailsFormValues` shape when
 * no restaurant profile is loaded yet. Reservation timing and `bookingPolicy`
 * fields are required by the shared form-value type but are not edited from the
 * Profile route — the BookingRulesSubform on Availability is the canonical home
 * for those fields. The defaults here only satisfy the shared shape.
 */
export const EMPTY_PROFILE_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
  businessDescription: null,
  managerName: null,
  managerDailySummaryEnabled: false,
  managerWhatsappEnabled: false,
  managerNotificationPhone: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  // The four fields below live on the Availability route's BookingRulesSubform.
  // They are not rendered on Profile but are part of the shared form-value type.
  bookingPolicy: null,
  reservationIntervalMinutes: DEFAULT_RESERVATION_INTERVAL_MINUTES,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  sundayRoastEnabled: false,
};

export function buildProfileValues(
  profile: RestaurantProfile | null | undefined,
): RestaurantDetailsFormValues {
  if (!profile) {
    return EMPTY_PROFILE_VALUES;
  }

  return {
    name: profile.name,
    slug: profile.slug ?? '',
    timezone: profile.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    address: profile.address,
    businessDescription: profile.businessDescription,
    managerName: profile.managerName,
    managerDailySummaryEnabled: profile.managerDailySummaryEnabled,
    managerWhatsappEnabled: profile.managerWhatsappEnabled,
    managerNotificationPhone: profile.managerNotificationPhone,
    googleMapUrl: profile.googleMapUrl,
    googleReviewUrl: profile.googleReviewUrl,
    bookingPolicy: profile.bookingPolicy,
    reservationIntervalMinutes: profile.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: profile.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: profile.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: profile.reservationLifecycleGraceMinutes,
    sundayRoastEnabled: profile.sundayRoastEnabled,
  };
}

export function hasProfileValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function displayProfileValue(value: string | null | undefined, fallback: string): string {
  return hasProfileValue(value) ? value.trim() : fallback;
}
