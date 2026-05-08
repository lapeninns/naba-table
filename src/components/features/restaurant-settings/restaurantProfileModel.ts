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
    label: 'Manager alerts',
    href: '#profile-notifications',
    formId: PROFILE_SECTION_FORMS.notifications,
    actionLabel: 'Save manager alerts',
  },
  {
    key: 'discovery',
    label: 'Optional discovery details',
    href: '#profile-discovery',
    actionLabel: 'Review discovery',
  },
  {
    key: 'advanced',
    label: 'Booking page URL',
    href: '#profile-booking-url',
    formId: PROFILE_SECTION_FORMS.advanced,
    actionLabel: 'Save booking URL',
  },
] as const;

export type ReadinessItemKey =
  | 'name'
  | 'logo'
  | 'description'
  | 'bookingUrl'
  | 'contactPhone'
  | 'contactEmail'
  | 'address'
  | 'timezone'
  | 'mapUrl';

type ReadinessItem = {
  key: ReadinessItemKey;
  label: string;
  href: string;
  required: boolean;
  isComplete: (values: RestaurantDetailsFormValues, logoUrl: string | null) => boolean;
};

/**
 * The required-vs-optional split lets the UI promote the few items that block
 * "make booking link live" (RP-UX-03) without hiding the longer enrichment list.
 */
const READINESS_ITEMS: readonly ReadinessItem[] = [
  {
    key: 'name',
    label: 'Restaurant name',
    href: '#profile-identity',
    required: true,
    isComplete: (values) => hasProfileValue(values.name),
  },
  {
    key: 'bookingUrl',
    label: 'Public booking page URL',
    href: '#profile-booking-url',
    required: true,
    isComplete: (values) => hasProfileValue(values.slug),
  },
  {
    key: 'contactPhone',
    label: 'Contact phone',
    href: '#profile-contact',
    required: true,
    isComplete: (values) => hasProfileValue(values.contactPhone),
  },
  {
    key: 'timezone',
    label: 'Timezone',
    href: '#profile-contact',
    required: true,
    isComplete: (values) => hasProfileValue(values.timezone),
  },
  {
    key: 'logo',
    label: 'Logo',
    href: '#profile-identity',
    required: false,
    isComplete: (_values, logoUrl) => hasProfileValue(logoUrl),
  },
  {
    key: 'description',
    label: 'Business description',
    href: '#profile-identity',
    required: false,
    isComplete: (values) => hasProfileValue(values.businessDescription),
  },
  {
    key: 'contactEmail',
    label: 'Contact email',
    href: '#profile-contact',
    required: false,
    isComplete: (values) => hasProfileValue(values.contactEmail),
  },
  {
    key: 'address',
    label: 'Address',
    href: '#profile-contact',
    required: false,
    isComplete: (values) => hasProfileValue(values.address),
  },
  {
    key: 'mapUrl',
    label: 'Google Maps link',
    href: '#profile-contact',
    required: false,
    isComplete: (values) => hasProfileValue(values.googleMapUrl),
  },
] as const;

export type ReadinessSummaryItem = {
  key: ReadinessItemKey;
  label: string;
  href: string;
  required: boolean;
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
 * Computes the readiness summary that powers both analytics and the rendered
 * readiness checklist at the top of the Profile page (RP-UX-04). Required items
 * gate "make booking link live" (RP-UX-03); the remainder enrich discovery.
 */
export function deriveReadiness(values: RestaurantDetailsFormValues, logoUrl: string | null) {
  const toSummary = (item: ReadinessItem): ReadinessSummaryItem => ({
    key: item.key,
    label: item.label,
    href: item.href,
    required: item.required,
  });
  const completed = READINESS_ITEMS.filter((item) => item.isComplete(values, logoUrl)).map(
    toSummary,
  );
  const missing = READINESS_ITEMS.filter((item) => !item.isComplete(values, logoUrl)).map(
    toSummary,
  );
  const missingRequired = missing.filter((item) => item.required);
  const score = Math.round((completed.length / READINESS_ITEMS.length) * 100);

  return {
    completed,
    missing,
    missingRequired,
    score,
  };
}
