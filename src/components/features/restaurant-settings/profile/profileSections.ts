import { sanitizePayload } from '../../../../../components/ops/restaurants/restaurantDetailsFormModel';

import type { ProfileAnalyticsSection } from '../../../../../components/ops/restaurants/details/shared';
import type {
  DetailsField,
  FormState,
} from '../../../../../components/ops/restaurants/restaurantDetailsFormModel';
import type { RestaurantProfile } from '@/services/ops/restaurants';

/** Section ids double as the analytics `dirty_sections` keys, so they stay stable. */
export type ProfileSectionId = 'public' | 'notifications';

export type ProfileSectionDefinition = {
  id: ProfileSectionId;
  /** Section name used in the jump bar, the save bar and the success toast. */
  name: string;
  description: string;
  /** Who sees what this section controls. */
  audience: 'Guest-facing' | 'Staff only';
  /** DOM id of the section. Other pages link to these anchors, so they never change. */
  anchorId: string;
  /** Fields in the order they appear on the page. */
  fields: readonly DetailsField[];
  analyticsSection: ProfileAnalyticsSection;
  /**
   * The partial payload this section sends to `PATCH /api/ops/restaurants/:id`. `dirtyFields`
   * are this section's fields that differ from the saved values.
   */
  buildPayload: (
    state: FormState,
    dirtyFields: ReadonlySet<DetailsField>,
  ) => Partial<RestaurantProfile>;
};

/** A labelled group of fields inside a section, with its own jump-bar anchor. */
export type ProfileFieldGroupDefinition = {
  name: string;
  /** DOM id of the group. Other pages deep-link here, so these never change. */
  anchorId: string;
  fields: readonly DetailsField[];
};

/**
 * The public details form: identity and booking page link first, then location and contact.
 * It is one form, saved in one request.
 */
export const PROFILE_FIELD_GROUPS: readonly ProfileFieldGroupDefinition[] = [
  {
    name: 'Name and booking link',
    anchorId: 'profile-identity',
    fields: ['name', 'slug', 'businessDescription'],
  },
  {
    name: 'Location and contact',
    anchorId: 'profile-contact',
    fields: [
      'timezone',
      'address',
      'googleMapUrl',
      'contactPhone',
      'contactEmail',
      'googleReviewUrl',
    ],
  },
];

/** Anchor of the booking page link field; older links point straight at it. */
export const PROFILE_BOOKING_URL_ANCHOR_ID = 'profile-booking-url';

export const PROFILE_SECTION_DEFINITIONS: readonly ProfileSectionDefinition[] = [
  {
    id: 'public',
    name: 'Public details',
    description: 'Shown on your booking page, confirmations and previews.',
    audience: 'Guest-facing',
    anchorId: 'profile-public-details',
    fields: PROFILE_FIELD_GROUPS.flatMap((group) => group.fields),
    analyticsSection: 'public_details',
    buildPayload: (state) => {
      const payload = sanitizePayload(state);
      return {
        name: payload.name,
        slug: payload.slug,
        businessDescription: payload.businessDescription,
        timezone: payload.timezone,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        address: payload.address,
        googleMapUrl: payload.googleMapUrl,
        googleReviewUrl: payload.googleReviewUrl,
      };
    },
  },
];

/**
 * Staff communications: who the restaurant tells about bookings. Restaurant-level settings,
 * saved through the same restaurant update endpoint as before.
 */
export const STAFF_COMMUNICATIONS_SECTION_DEFINITIONS: readonly ProfileSectionDefinition[] = [
  {
    id: 'notifications',
    name: 'Manager alerts',
    description: 'Who gets told about bookings. Guests never see the alert number.',
    audience: 'Staff only',
    anchorId: 'staff-communications-manager-alerts',
    fields: [
      'managerName',
      'managerNotificationPhone',
      'managerDailySummaryEnabled',
      'managerWhatsappEnabled',
    ],
    analyticsSection: 'manager_notifications',
    // Only changed fields are sent: the server derives the WhatsApp consent from the stored
    // row, so an untouched toggle must not look like a fresh opt-in.
    buildPayload: (state, dirtyFields) => {
      const payload = sanitizePayload(state);
      const next: Partial<RestaurantProfile> = {};
      if (dirtyFields.has('managerName')) next.managerName = payload.managerName;
      if (dirtyFields.has('managerNotificationPhone')) {
        next.managerNotificationPhone = payload.managerNotificationPhone;
      }
      if (dirtyFields.has('managerDailySummaryEnabled')) {
        next.managerDailySummaryEnabled = payload.managerDailySummaryEnabled;
      }
      if (dirtyFields.has('managerWhatsappEnabled')) {
        next.managerWhatsappEnabled = payload.managerWhatsappEnabled;
      }
      return next;
    },
  },
];

/** Every field the Profile page edits, in page order. */
export const PROFILE_FIELD_ORDER: readonly DetailsField[] = PROFILE_SECTION_DEFINITIONS.flatMap(
  (section) => section.fields,
);

export const PROFILE_FIELD_LABELS: Partial<Record<DetailsField, string>> = {
  name: 'Restaurant name',
  businessDescription: 'Business description',
  slug: 'Booking page link',
  timezone: 'Timezone',
  address: 'Address',
  googleMapUrl: 'Google Maps link',
  contactPhone: 'Public phone',
  contactEmail: 'Contact email',
  googleReviewUrl: 'Guest review link',
  managerName: 'Manager name',
  managerNotificationPhone: 'Manager alert number',
  managerDailySummaryEnabled: 'Daily booking summary',
  managerWhatsappEnabled: 'Try WhatsApp first',
};

/** DOM id of each field's control, used by "Show first issue" and the readiness links. */
export const PROFILE_FIELD_DOM_IDS: Partial<Record<DetailsField, string>> = {
  name: 'restaurant-name',
  businessDescription: 'restaurant-business-description',
  slug: 'restaurant-slug',
  timezone: 'restaurant-timezone',
  address: 'restaurant-address',
  googleMapUrl: 'restaurant-google-map',
  contactPhone: 'restaurant-phone',
  contactEmail: 'restaurant-email',
  googleReviewUrl: 'restaurant-google-review',
  managerName: 'restaurant-manager-name',
  managerNotificationPhone: 'restaurant-manager-notification-phone',
  managerDailySummaryEnabled: 'restaurant-manager-daily-summary-enabled',
  managerWhatsappEnabled: 'restaurant-manager-whatsapp-enabled',
};

/** Scrolls a field into view and focuses it without a second scroll jump. */
export function focusProfileElement(elementId: string) {
  const element = typeof document !== 'undefined' ? document.getElementById(elementId) : null;
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  element.focus({ preventScroll: true });
}
