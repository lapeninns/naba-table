import { Clock3, ImageIcon, MapPin, Phone, type LucideIcon } from 'lucide-react';

import {
  COMMON_TIMEZONES,
  type RestaurantDetailsFormValues,
} from '@/components/ops/restaurants/RestaurantDetailsForm';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { RestaurantProfile } from '@/services/ops/restaurants';

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

export type ProfileReadinessItem = {
  key: string;
  label: string;
  impact: string;
  sectionHref: string;
  isComplete: (values: RestaurantDetailsFormValues, logoUrl: string | null) => boolean;
};

export type QuickEditAction = {
  key: 'name_logo' | 'contact' | 'address' | 'hours';
  label: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

export type ProfileSectionMapItem = {
  label: string;
  detail: string;
  href: string;
};

export const PROFILE_SECTION_FORMS = {
  brand: 'restaurant-profile-brand-form',
  contact: 'restaurant-profile-contact-form',
  notifications: 'restaurant-profile-notifications-form',
  advanced: 'restaurant-profile-advanced-form',
} as const satisfies Partial<Record<ProfileDirtyKey, string>>;

export const PROFILE_DIRTY_SECTIONS: readonly ProfileDirtySection[] = [
  {
    key: 'brand',
    label: 'Basic info and branding',
    href: '#profile-identity',
    formId: PROFILE_SECTION_FORMS.brand,
    actionLabel: 'Save basic info',
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
    label: 'Operational details',
    href: '#profile-operations',
    formId: PROFILE_SECTION_FORMS.notifications,
    actionLabel: 'Save operations',
  },
  {
    key: 'discovery',
    label: 'Visibility',
    href: '#profile-visibility',
    actionLabel: 'Review visibility',
  },
  {
    key: 'advanced',
    label: 'Operational details',
    href: '#profile-operations',
    formId: PROFILE_SECTION_FORMS.advanced,
    actionLabel: 'Save link',
  },
] as const;

export const READINESS_ITEMS: readonly ProfileReadinessItem[] = [
  {
    key: 'name',
    label: 'Restaurant name',
    impact: 'Shown on the guest booking page and in confirmation messages.',
    sectionHref: '#profile-identity',
    isComplete: (values) => hasProfileValue(values.name),
  },
  {
    key: 'logo',
    label: 'Logo',
    impact: 'Builds recognition in booking emails and owner-facing previews.',
    sectionHref: '#profile-identity',
    isComplete: (_values, logoUrl) => hasProfileValue(logoUrl),
  },
  {
    key: 'description',
    label: 'Business description',
    impact: 'Helps guests understand the restaurant before booking.',
    sectionHref: '#profile-identity',
    isComplete: (values) => hasProfileValue(values.businessDescription),
  },
  {
    key: 'contactPhone',
    label: 'Public phone',
    impact: 'Gives guests a trusted fallback if a booking needs attention.',
    sectionHref: '#profile-contact',
    isComplete: (values) => hasProfileValue(values.contactPhone),
  },
  {
    key: 'contactEmail',
    label: 'Public email',
    impact: 'Keeps booking questions and guest follow-up routed correctly.',
    sectionHref: '#profile-contact',
    isComplete: (values) => hasProfileValue(values.contactEmail),
  },
  {
    key: 'address',
    label: 'Address',
    impact: 'Supports directions, guest confidence, and Google comparison.',
    sectionHref: '#profile-contact',
    isComplete: (values) => hasProfileValue(values.address),
  },
  {
    key: 'timezone',
    label: 'Timezone',
    impact: 'Keeps opening hours, bookings, and reminders on the right clock.',
    sectionHref: '#profile-contact',
    isComplete: (values) => hasProfileValue(values.timezone),
  },
  {
    key: 'mapUrl',
    label: 'Google Maps link',
    impact: 'Lets guests open directions directly from public touchpoints.',
    sectionHref: '#profile-contact',
    isComplete: (values) => hasProfileValue(values.googleMapUrl),
  },
] as const;

export const QUICK_EDIT_ACTIONS: readonly QuickEditAction[] = [
  {
    key: 'name_logo',
    label: 'Name & logo',
    detail: 'Branding',
    href: '#profile-identity',
    icon: ImageIcon,
  },
  {
    key: 'contact',
    label: 'Contact',
    detail: 'Phone + email',
    href: '#profile-contact',
    icon: Phone,
  },
  {
    key: 'address',
    label: 'Address',
    detail: 'Location',
    href: '#profile-contact',
    icon: MapPin,
  },
  {
    key: 'hours',
    label: 'Hours',
    detail: 'Availability',
    href: '/app/settings/restaurant/availability',
    icon: Clock3,
  },
] as const;

export const PROFILE_SECTION_MAP: readonly ProfileSectionMapItem[] = [
  {
    label: 'Basic Info',
    detail: 'Name and public description',
    href: '#profile-identity',
  },
  {
    label: 'Branding',
    detail: 'Logo and guest recognition',
    href: '#profile-identity',
  },
  {
    label: 'Contact',
    detail: 'Phone and email',
    href: '#profile-contact',
  },
  {
    label: 'Location',
    detail: 'Address and directions',
    href: '#profile-contact',
  },
  {
    label: 'Operational Details',
    detail: 'Alerts and booking links',
    href: '#profile-operations',
  },
  {
    label: 'Visibility',
    detail: 'Discovery and Google-facing details',
    href: '#profile-visibility',
  },
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

export function formatLastUpdated(updatedAt: string | null | undefined): string | null {
  if (!updatedAt) {
    return null;
  }

  const parsed = new Date(updatedAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .padEnd(2, 'R');
}

export function deriveReadiness(values: RestaurantDetailsFormValues, logoUrl: string | null) {
  const completed = READINESS_ITEMS.filter((item) => item.isComplete(values, logoUrl));
  const missing = READINESS_ITEMS.filter((item) => !item.isComplete(values, logoUrl));
  const score = Math.round((completed.length / READINESS_ITEMS.length) * 100);

  return {
    completed,
    missing,
    score,
  };
}
