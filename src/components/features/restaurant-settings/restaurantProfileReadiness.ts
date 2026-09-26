import { type RestaurantDetailsFormValues } from '@/components/ops/restaurants/RestaurantDetailsForm';
import {
  PROFILE_SETUP_REQUIRED_FIELDS,
  isProfileSetupComplete,
  type ProfileSetupFieldKey,
} from '@/lib/ops/restaurant-setup-rules';

import { hasProfileValue } from './restaurantProfileValues';

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
  required: boolean;
  isComplete: (values: RestaurantDetailsFormValues, logoUrl: string | null) => boolean;
};

const PROFILE_SETUP_READINESS_KEYS = {
  name: 'name',
  slug: 'bookingUrl',
  timezone: 'timezone',
  contactPhone: 'contactPhone',
} as const satisfies Record<ProfileSetupFieldKey, ReadinessItemKey>;

const REQUIRED_READINESS_KEYS = new Set<ReadinessItemKey>(
  PROFILE_SETUP_REQUIRED_FIELDS.map((field) => PROFILE_SETUP_READINESS_KEYS[field.key]),
);

function isRequiredReadinessKey(key: ReadinessItemKey): boolean {
  return REQUIRED_READINESS_KEYS.has(key);
}

/**
 * The required-vs-optional split lets the UI promote the few items that block
 * "make booking link live" (RP-UX-03) without hiding the longer enrichment list.
 */
const READINESS_ITEMS: readonly ReadinessItem[] = [
  {
    key: 'name',
    label: 'Restaurant name',
    required: isRequiredReadinessKey('name'),
    isComplete: (values) => hasProfileValue(values.name),
  },
  {
    key: 'bookingUrl',
    label: 'Booking page link',
    required: isRequiredReadinessKey('bookingUrl'),
    isComplete: (values) => hasProfileValue(values.slug),
  },
  {
    key: 'contactPhone',
    label: 'Public phone',
    required: isRequiredReadinessKey('contactPhone'),
    isComplete: (values) => hasProfileValue(values.contactPhone),
  },
  {
    key: 'timezone',
    label: 'Timezone',
    required: isRequiredReadinessKey('timezone'),
    isComplete: (values) => hasProfileValue(values.timezone),
  },
  {
    key: 'logo',
    label: 'Logo',
    required: false,
    isComplete: (_values, logoUrl) => hasProfileValue(logoUrl),
  },
  {
    key: 'description',
    label: 'Business description',
    required: false,
    isComplete: (values) => hasProfileValue(values.businessDescription),
  },
  {
    key: 'contactEmail',
    label: 'Contact email',
    required: false,
    isComplete: (values) => hasProfileValue(values.contactEmail),
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    isComplete: (values) => hasProfileValue(values.address),
  },
  {
    key: 'mapUrl',
    label: 'Google Maps link',
    required: false,
    isComplete: (values) => hasProfileValue(values.googleMapUrl),
  },
] as const;

export type ReadinessSummaryItem = {
  key: ReadinessItemKey;
  label: string;
  required: boolean;
};

export type ReadinessChecklistItem = ReadinessSummaryItem & { complete: boolean };

export function isProfileReadinessBlockingComplete(values: RestaurantDetailsFormValues): boolean {
  return isProfileSetupComplete(values);
}

/**
 * Computes the readiness summary that powers both analytics and the Profile readiness
 * checklist (RP-UX-04). Required items
 * gate "make booking link live" (RP-UX-03); the remainder enrich discovery.
 */
export function deriveReadiness(values: RestaurantDetailsFormValues, logoUrl: string | null) {
  const toSummary = (item: ReadinessItem): ReadinessSummaryItem => ({
    key: item.key,
    label: item.label,
    required: item.required,
  });
  const items: ReadinessChecklistItem[] = READINESS_ITEMS.map((item) => ({
    ...toSummary(item),
    complete: item.isComplete(values, logoUrl),
  }));
  const completed = READINESS_ITEMS.filter((item) => item.isComplete(values, logoUrl)).map(
    toSummary,
  );
  const missing = READINESS_ITEMS.filter((item) => !item.isComplete(values, logoUrl)).map(
    toSummary,
  );
  const missingRequired = missing.filter((item) => item.required);
  const score = Math.round((completed.length / READINESS_ITEMS.length) * 100);

  return {
    /** Every item, required first, in checklist order. */
    items,
    completed,
    missing,
    missingRequired,
    blockingComplete: isProfileReadinessBlockingComplete(values),
    score,
  };
}
