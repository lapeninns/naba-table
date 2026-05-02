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
  managerDailySummaryEnabled: false,
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
};

export type ProfileDirtyKey = 'brand' | 'contact' | 'notifications' | 'discovery' | 'advanced';

export type ProfileDirtySection = {
  key: ProfileDirtyKey;
  label: string;
  href: string;
  formId?: string;
  actionLabel: string;
};

export const PROFILE_SECTION_FORMS = {
  brand: 'restaurant-profile-brand-form',
  contact: 'restaurant-profile-contact-form',
  notifications: 'restaurant-profile-notifications-form',
  advanced: 'restaurant-profile-advanced-form',
} as const satisfies Partial<Record<ProfileDirtyKey, string>>;

/**
 * Each card on Profile owns its own anchor and (when applicable) a form id, so
 * the sticky save bar can submit per-section without colliding labels/anchors.
 */
export const PROFILE_DIRTY_SECTIONS: readonly ProfileDirtySection[] = [
  {
    key: 'brand',
    label: 'Brand and identity',
    href: '#profile-identity',
    formId: PROFILE_SECTION_FORMS.brand,
    actionLabel: 'Save brand',
  },
  {
    key: 'contact',
    label: 'Contact and location',
    href: '#profile-contact',
    formId: PROFILE_SECTION_FORMS.contact,
    actionLabel: 'Save contact',
  },
  {
    key: 'notifications',
    label: 'Manager notifications',
    href: '#profile-notifications',
    formId: PROFILE_SECTION_FORMS.notifications,
    actionLabel: 'Save manager alerts',
  },
  {
    key: 'discovery',
    label: 'Discovery details',
    href: '#profile-discovery',
    actionLabel: 'Review discovery',
  },
  {
    key: 'advanced',
    label: 'Advanced',
    href: '#profile-advanced',
    formId: PROFILE_SECTION_FORMS.advanced,
    actionLabel: 'Save advanced',
  },
] as const;

type ReadinessItem = {
  key: string;
  isComplete: (values: RestaurantDetailsFormValues, logoUrl: string | null) => boolean;
};

const READINESS_ITEMS: readonly ReadinessItem[] = [
  { key: 'name', isComplete: (values) => hasProfileValue(values.name) },
  { key: 'logo', isComplete: (_values, logoUrl) => hasProfileValue(logoUrl) },
  { key: 'description', isComplete: (values) => hasProfileValue(values.businessDescription) },
  { key: 'contactPhone', isComplete: (values) => hasProfileValue(values.contactPhone) },
  { key: 'contactEmail', isComplete: (values) => hasProfileValue(values.contactEmail) },
  { key: 'address', isComplete: (values) => hasProfileValue(values.address) },
  { key: 'timezone', isComplete: (values) => hasProfileValue(values.timezone) },
  { key: 'mapUrl', isComplete: (values) => hasProfileValue(values.googleMapUrl) },
] as const;

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
    managerDailySummaryEnabled: profile.managerDailySummaryEnabled,
    managerNotificationPhone: profile.managerNotificationPhone,
    googleMapUrl: profile.googleMapUrl,
    googleReviewUrl: profile.googleReviewUrl,
    bookingPolicy: profile.bookingPolicy,
    reservationIntervalMinutes: profile.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: profile.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: profile.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: profile.reservationLifecycleGraceMinutes,
  };
}

export function hasProfileValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function displayProfileValue(value: string | null | undefined, fallback: string): string {
  return hasProfileValue(value) ? value.trim() : fallback;
}

/**
 * Computes a slim readiness summary used solely to feed analytics events
 * (`completeness_score`, `missing_count`, `missing_fields`). The page does not
 * render a readiness checklist; richer per-item metadata was removed.
 */
export function deriveReadiness(values: RestaurantDetailsFormValues, logoUrl: string | null) {
  const completed = READINESS_ITEMS.filter((item) => item.isComplete(values, logoUrl)).map(
    (item) => ({ key: item.key }),
  );
  const missing = READINESS_ITEMS.filter((item) => !item.isComplete(values, logoUrl)).map(
    (item) => ({ key: item.key }),
  );
  const score = Math.round((completed.length / READINESS_ITEMS.length) * 100);

  return {
    completed,
    missing,
    score,
  };
}
