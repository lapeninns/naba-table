import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';

import type { UpdateRestaurantInput } from '@/app/api/ops/restaurants/schema';
import type { ProfileFieldVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import type { RestaurantProfile } from '@/services/ops/restaurants';

export type RestaurantDetailsFormValues = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  managerName: string | null;
  managerDailySummaryEnabled: boolean;
  managerWhatsappEnabled: boolean;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
};

export type RestaurantDetailsDraftValues = Partial<RestaurantDetailsFormValues>;

export type FormState = {
  name: string;
  slug: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  businessDescription: string;
  managerName: string;
  managerDailySummaryEnabled: boolean;
  managerWhatsappEnabled: boolean;
  managerNotificationPhone: string;
  googleMapUrl: string;
  googleReviewUrl: string;
  bookingPolicy: string;
  reservationIntervalMinutes: string;
  reservationDefaultDurationMinutes: string;
  reservationLastSeatingBufferMinutes: string;
  reservationLifecycleGraceMinutes: string;
};

export type FormErrors = Partial<Record<keyof FormState, string>>;

export type DetailsField = keyof FormState;

export type ProfileCompletionAnalytics = {
  required_field_count: number;
  completed_required_field_count: number;
  required_fields_complete: boolean;
  missing_required_fields: string[];
  profile_field_count: number;
  completed_profile_field_count: number;
  profile_completion_score: number;
  missing_profile_fields: string[];
};

export type GbpComparableField =
  | 'name'
  | 'businessDescription'
  | 'contactPhone'
  | 'address'
  | 'googleMapUrl'
  | 'googleReviewUrl';

export type GbpFieldStatus = 'verified' | 'drifted' | 'unavailable';

export const FIELD_TOOLTIPS = {
  name: 'Shown on the guest booking page, booking confirmations, and public-facing previews.',
  slug: 'Controls the public booking URL guests share and revisit. Change it only when the public link should change.',
  timezone:
    'Keeps opening hours, reservations, and reminders aligned to the restaurant’s local time.',
  contactEmail: 'Public inbox for guest questions and booking follow-up.',
  contactPhone: 'Public fallback number guests can trust when a booking needs attention.',
  address: 'Helps guests plan arrival and keeps local profile comparisons accurate.',
  businessDescription:
    'Public copy guests may see when they find or book this restaurant. Keep it clear and current.',
  reservationInterval:
    'Spacing between available booking slots. Shorter intervals create more options but increase booking traffic.',
  reservationDuration:
    'Default table time that pre-fills new reservations. Staff can override per booking if needed.',
  lastSeatingBuffer:
    'Minimum time before operating close when the final party may be seated. Longer party-size table times can make the last available slot earlier.',
  lifecycleGrace:
    'Minutes after the reservation end time when staff can still check out or mark no-shows.',
  bookingPolicy:
    'Optional message shown to guests during booking and in confirmations (e.g., grace periods, large-party policies).',
  managerName:
    'Manager or host name shown to guests as the sender of review-request emails (e.g. “Sam from The Old Crown”). Leave blank to send as the venue name.',
  managerNotificationPhone:
    'Direct delivery number for the daily manager SMS summary. Use E.164 format such as +447700900000.',
  managerDailySummaryEnabled:
    'Turns the 10:00 local-time manager booking summary SMS on or off for this restaurant.',
  managerWhatsappEnabled:
    'Nabatable sends the daily summary via WhatsApp first for this manager number, with SMS as the fallback.',
  googleReviewUrl: 'Guest review link sent in post-visit emails.',
  googleMapUrl: 'Map link shared with guests for directions.',
} as const;

export const COMMON_TIMEZONES = [
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Europe/Paris',
  'Europe/Berlin',
] as const;

export const ALL_TIMEZONES =
  typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [...COMMON_TIMEZONES];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const REQUIRED_PROFILE_FIELDS = ['name', 'timezone', 'slug'] as const;
const HIGH_IMPACT_PROFILE_FIELDS = [
  'name',
  'timezone',
  'businessDescription',
  'contactEmail',
  'contactPhone',
  'address',
  'googleMapUrl',
  'googleReviewUrl',
] as const satisfies readonly (keyof RestaurantDetailsFormValues)[];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparablePhone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.length > 0 ? normalized : null;
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${normalizedPath}${parsed.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function compareFieldValue(
  field: GbpComparableField,
  currentValue: string,
  gbpValue: string | null | undefined,
): boolean {
  switch (field) {
    case 'contactPhone': {
      const currentPhone = normalizeComparablePhone(currentValue);
      const providerPhone = normalizeComparablePhone(gbpValue);
      return Boolean(currentPhone) && currentPhone === providerPhone;
    }
    case 'googleMapUrl':
    case 'googleReviewUrl': {
      const currentUrl = normalizeComparableUrl(currentValue);
      const providerUrl = normalizeComparableUrl(gbpValue);
      return Boolean(currentUrl) && currentUrl === providerUrl;
    }
    case 'name':
    case 'businessDescription':
    case 'address': {
      const currentText = normalizeComparableText(currentValue);
      const providerText = normalizeComparableText(gbpValue);
      return Boolean(currentText) && currentText === providerText;
    }
    default:
      return false;
  }
}

function formatTimezoneOffset(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date());
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

export function buildTimezoneLabel(timezone: string): string {
  const city = timezone.split('/').at(-1)?.replace(/_/g, ' ') ?? timezone;
  return `${city} (${formatTimezoneOffset(timezone)})`;
}

/** "London (GMT+1) · Europe/London": city and offset first, then the IANA zone. */
export function buildTimezoneOptionLabel(timezone: string): string {
  return `${buildTimezoneLabel(timezone)} · ${timezone}`;
}

export type TimezoneRegionGroup = { region: string; timezones: string[] };

/**
 * IANA zones grouped by region ("Europe", "America", …) for the timezone select. A saved
 * zone missing from the runtime list is kept so the current value always has an option.
 */
export function groupTimezonesByRegion(
  timezones: readonly string[],
  current?: string | null,
): TimezoneRegionGroup[] {
  const all = current && !timezones.includes(current) ? [current, ...timezones] : timezones;
  const groups = new Map<string, string[]>();
  for (const timezone of all) {
    const region = timezone.includes('/') ? (timezone.split('/')[0] ?? 'Other') : 'Other';
    const list = groups.get(region);
    if (list) {
      list.push(timezone);
    } else {
      groups.set(region, [timezone]);
    }
  }
  return [...groups.entries()].map(([region, list]) => ({ region, timezones: list }));
}

export function mapInitialValues(values: RestaurantDetailsFormValues): FormState {
  return {
    name: values.name ?? '',
    slug: values.slug ?? '',
    timezone: values.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: values.contactEmail ?? '',
    contactPhone: values.contactPhone ?? '',
    address: values.address ?? '',
    businessDescription: values.businessDescription ?? '',
    managerName: values.managerName ?? '',
    managerDailySummaryEnabled: values.managerDailySummaryEnabled ?? false,
    managerWhatsappEnabled: values.managerWhatsappEnabled ?? false,
    managerNotificationPhone: values.managerNotificationPhone ?? '',
    bookingPolicy: values.bookingPolicy ?? '',
    reservationIntervalMinutes:
      values.reservationIntervalMinutes !== undefined && values.reservationIntervalMinutes !== null
        ? String(values.reservationIntervalMinutes)
        : '',
    reservationDefaultDurationMinutes:
      values.reservationDefaultDurationMinutes !== undefined &&
      values.reservationDefaultDurationMinutes !== null
        ? String(values.reservationDefaultDurationMinutes)
        : '',
    reservationLastSeatingBufferMinutes:
      values.reservationLastSeatingBufferMinutes !== undefined &&
      values.reservationLastSeatingBufferMinutes !== null
        ? String(values.reservationLastSeatingBufferMinutes)
        : '',
    reservationLifecycleGraceMinutes:
      values.reservationLifecycleGraceMinutes !== undefined &&
      values.reservationLifecycleGraceMinutes !== null
        ? String(values.reservationLifecycleGraceMinutes)
        : '',
    googleMapUrl: values.googleMapUrl ?? '',
    googleReviewUrl: values.googleReviewUrl ?? '',
  };
}

export function mapRestaurantProfileValues(
  profile: RestaurantProfile,
): RestaurantDetailsFormValues {
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
  };
}

export function sanitizePayload(state: FormState): UpdateRestaurantInput {
  const trim = (value: string) => value.trim();
  const trimmedName = trim(state.name);
  const trimmedSlug = trim(state.slug);
  const trimmedTimezone = trim(state.timezone);
  const trimmedEmail = trim(state.contactEmail);
  const trimmedPhone = trim(state.contactPhone);
  const trimmedAddress = trim(state.address);
  const trimmedBusinessDescription = trim(state.businessDescription);
  const trimmedManagerName = trim(state.managerName);
  const trimmedManagerNotificationPhone = trim(state.managerNotificationPhone);
  const trimmedMapUrl = trim(state.googleMapUrl);
  const trimmedReviewUrl = trim(state.googleReviewUrl);
  const trimmedPolicy = trim(state.bookingPolicy);
  const intervalMinutes = Number.parseInt(state.reservationIntervalMinutes, 10);
  const defaultDurationMinutes = Number.parseInt(state.reservationDefaultDurationMinutes, 10);
  const lastSeatingBufferMinutes = Number.parseInt(state.reservationLastSeatingBufferMinutes, 10);
  const lifecycleGraceMinutes = Number.parseInt(state.reservationLifecycleGraceMinutes, 10);

  return {
    name: trimmedName,
    slug: trimmedSlug,
    timezone: trimmedTimezone,
    contactEmail: trimmedEmail.length > 0 ? trimmedEmail : null,
    contactPhone: trimmedPhone.length > 0 ? trimmedPhone : null,
    address: trimmedAddress.length > 0 ? trimmedAddress : null,
    businessDescription: trimmedBusinessDescription.length > 0 ? trimmedBusinessDescription : null,
    managerName: trimmedManagerName.length > 0 ? trimmedManagerName : null,
    managerDailySummaryEnabled: state.managerDailySummaryEnabled,
    managerWhatsappEnabled: state.managerWhatsappEnabled,
    managerNotificationPhone:
      trimmedManagerNotificationPhone.length > 0 ? trimmedManagerNotificationPhone : null,
    googleMapUrl: trimmedMapUrl.length > 0 ? trimmedMapUrl : null,
    googleReviewUrl: trimmedReviewUrl.length > 0 ? trimmedReviewUrl : null,
    bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
    reservationIntervalMinutes: intervalMinutes,
    reservationDefaultDurationMinutes: defaultDurationMinutes,
    reservationLastSeatingBufferMinutes: lastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: lifecycleGraceMinutes,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
  };
}

export function validateRestaurantDetails(state: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!state.name.trim()) {
    errors.name = 'Restaurant name is required';
  }

  const slug = state.slug.trim();
  if (!slug) {
    errors.slug = 'Booking page link is required';
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = 'Booking page link must contain only lowercase letters, numbers, and hyphens';
  }

  if (!state.timezone.trim()) {
    errors.timezone = 'Timezone is required';
  }

  const intervalRaw = state.reservationIntervalMinutes.trim();
  if (!intervalRaw) {
    errors.reservationIntervalMinutes = 'Reservation interval is required';
  } else {
    const intervalValue = Number(intervalRaw);
    if (!Number.isInteger(intervalValue)) {
      errors.reservationIntervalMinutes = 'Must be a whole number';
    } else if (
      intervalValue < RESERVATION_INTERVAL_MIN ||
      intervalValue > RESERVATION_INTERVAL_MAX
    ) {
      errors.reservationIntervalMinutes = `Must be between ${RESERVATION_INTERVAL_MIN} and ${RESERVATION_INTERVAL_MAX} minutes`;
    }
  }

  const durationRaw = state.reservationDefaultDurationMinutes.trim();
  if (!durationRaw) {
    errors.reservationDefaultDurationMinutes = 'Reservation duration is required';
  } else {
    const durationValue = Number(durationRaw);
    if (!Number.isInteger(durationValue)) {
      errors.reservationDefaultDurationMinutes = 'Must be a whole number';
    } else if (durationValue < 15 || durationValue > 300) {
      errors.reservationDefaultDurationMinutes = 'Must be between 15 and 300 minutes';
    }
  }

  const bufferRaw = state.reservationLastSeatingBufferMinutes.trim();
  if (!bufferRaw) {
    errors.reservationLastSeatingBufferMinutes = 'Last seating buffer is required';
  } else {
    const bufferValue = Number(bufferRaw);
    if (!Number.isInteger(bufferValue)) {
      errors.reservationLastSeatingBufferMinutes = 'Must be a whole number';
    } else if (bufferValue < 15 || bufferValue > 300) {
      errors.reservationLastSeatingBufferMinutes = 'Must be between 15 and 300 minutes';
    }
  }

  const graceRaw = state.reservationLifecycleGraceMinutes.trim();
  if (!graceRaw) {
    errors.reservationLifecycleGraceMinutes = 'Lifecycle grace period is required';
  } else {
    const graceValue = Number(graceRaw);
    if (!Number.isInteger(graceValue)) {
      errors.reservationLifecycleGraceMinutes = 'Must be a whole number';
    } else if (graceValue < 0 || graceValue > 120) {
      errors.reservationLifecycleGraceMinutes = 'Must be between 0 and 120 minutes';
    }
  }

  const email = state.contactEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.contactEmail = 'Invalid email format';
  }

  const phone = state.contactPhone.trim();
  if (phone && phone.length < 5) {
    errors.contactPhone = 'Phone number must be at least 5 characters';
  }

  const managerName = state.managerName.trim();
  if (managerName.length > 80) {
    errors.managerName = 'Manager name must be 80 characters or fewer';
  }

  const managerNotificationPhone = state.managerNotificationPhone.trim();
  if (state.managerDailySummaryEnabled && !managerNotificationPhone) {
    errors.managerNotificationPhone = 'Add a manager number before enabling daily SMS summaries';
  }
  if (state.managerWhatsappEnabled && !managerNotificationPhone) {
    errors.managerNotificationPhone = 'Add a manager number before enabling WhatsApp summaries';
  }
  if (managerNotificationPhone && !/^\+[1-9][0-9]{6,14}$/.test(managerNotificationPhone)) {
    errors.managerNotificationPhone = 'Use E.164 format such as +447700900000';
  }

  const reviewUrl = state.googleReviewUrl.trim();
  if (reviewUrl && !safeGoogleReviewUrl(reviewUrl)) {
    errors.googleReviewUrl = 'Enter an HTTPS Google review URL (e.g., https://g.page/.../review)';
  }

  const mapUrl = state.googleMapUrl.trim();
  if (mapUrl && !safeGoogleMapsUrl(mapUrl)) {
    errors.googleMapUrl = 'Enter an HTTPS Google Maps URL (e.g., https://maps.google.com/...)';
  }

  if (state.businessDescription.length > 4096) {
    errors.businessDescription = 'Business description must be 4096 characters or fewer';
  }

  return errors;
}

export function pickState(state: FormState, fields: readonly DetailsField[]): Partial<FormState> {
  return fields.reduce<Partial<FormState>>((result, field) => {
    result[field] = state[field] as never;
    return result;
  }, {});
}

export function filterErrors(errors: FormErrors, fields: readonly DetailsField[]): FormErrors {
  return fields.reduce<FormErrors>((result, field) => {
    if (errors[field]) {
      result[field] = errors[field];
    }
    return result;
  }, {});
}

function hasCompletedProfileValue(value: string | number | boolean | null | undefined): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return value !== null && value !== undefined;
}

export function buildProfileCompletionAnalytics(
  values: RestaurantDetailsFormValues,
): ProfileCompletionAnalytics {
  const missingRequiredFields = REQUIRED_PROFILE_FIELDS.filter(
    (field) => !hasCompletedProfileValue(values[field]),
  );
  const missingProfileFields = HIGH_IMPACT_PROFILE_FIELDS.filter(
    (field) => !hasCompletedProfileValue(values[field]),
  );

  return {
    required_field_count: REQUIRED_PROFILE_FIELDS.length,
    completed_required_field_count: REQUIRED_PROFILE_FIELDS.length - missingRequiredFields.length,
    required_fields_complete: missingRequiredFields.length === 0,
    missing_required_fields: missingRequiredFields,
    profile_field_count: HIGH_IMPACT_PROFILE_FIELDS.length,
    completed_profile_field_count: HIGH_IMPACT_PROFILE_FIELDS.length - missingProfileFields.length,
    profile_completion_score: Math.round(
      ((HIGH_IMPACT_PROFILE_FIELDS.length - missingProfileFields.length) /
        HIGH_IMPACT_PROFILE_FIELDS.length) *
        100,
    ),
    missing_profile_fields: missingProfileFields,
  };
}

function formatSectionSavedAt(updatedAt: string | null | undefined): string | null {
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

export function buildSubformSuccessMessage(
  message: string,
  updatedAt: string | null | undefined,
): string {
  const savedAt = formatSectionSavedAt(updatedAt);
  return savedAt ? `${message} Last updated ${savedAt}.` : message;
}

export function pickDraftValues(
  state: FormState,
  fields: readonly DetailsField[],
): RestaurantDetailsDraftValues {
  return fields.reduce<RestaurantDetailsDraftValues>((result, field) => {
    switch (field) {
      case 'managerDailySummaryEnabled':
        result.managerDailySummaryEnabled = state.managerDailySummaryEnabled;
        break;
      case 'managerWhatsappEnabled':
        result.managerWhatsappEnabled = state.managerWhatsappEnabled;
        break;
      case 'reservationIntervalMinutes':
      case 'reservationDefaultDurationMinutes':
      case 'reservationLastSeatingBufferMinutes':
      case 'reservationLifecycleGraceMinutes':
        result[field] = Number(state[field]);
        break;
      default:
        result[field] = state[field] as never;
    }

    return result;
  }, {});
}

export function getGbpStatuses(
  state: Record<GbpComparableField, string>,
  gbpFieldVerifications?: Partial<Record<GbpComparableField, ProfileFieldVerification>>,
): Record<GbpComparableField, GbpFieldStatus> {
  return {
    name: compareFieldValue('name', state.name, gbpFieldVerifications?.name?.providerValue)
      ? 'verified'
      : gbpFieldVerifications?.name?.providerValue || state.name
        ? 'drifted'
        : 'unavailable',
    businessDescription: compareFieldValue(
      'businessDescription',
      state.businessDescription,
      gbpFieldVerifications?.businessDescription?.providerValue,
    )
      ? 'verified'
      : gbpFieldVerifications?.businessDescription?.providerValue || state.businessDescription
        ? 'drifted'
        : 'unavailable',
    contactPhone: compareFieldValue(
      'contactPhone',
      state.contactPhone,
      gbpFieldVerifications?.contactPhone?.providerValue,
    )
      ? 'verified'
      : gbpFieldVerifications?.contactPhone?.providerValue || state.contactPhone
        ? 'drifted'
        : 'unavailable',
    address: compareFieldValue(
      'address',
      state.address,
      gbpFieldVerifications?.address?.providerValue,
    )
      ? 'verified'
      : gbpFieldVerifications?.address?.providerValue || state.address
        ? 'drifted'
        : 'unavailable',
    googleMapUrl: compareFieldValue(
      'googleMapUrl',
      state.googleMapUrl,
      gbpFieldVerifications?.googleMapUrl?.providerValue,
    )
      ? 'verified'
      : gbpFieldVerifications?.googleMapUrl?.providerValue || state.googleMapUrl
        ? 'drifted'
        : 'unavailable',
    googleReviewUrl: compareFieldValue(
      'googleReviewUrl',
      state.googleReviewUrl,
      gbpFieldVerifications?.googleReviewUrl?.providerValue,
    )
      ? 'verified'
      : gbpFieldVerifications?.googleReviewUrl?.providerValue || state.googleReviewUrl
        ? 'drifted'
        : 'unavailable',
  };
}
