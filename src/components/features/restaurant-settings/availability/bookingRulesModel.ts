import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import {
  COMMON_TIMEZONES,
  type RestaurantDetailsFormValues,
} from '../../../../../components/ops/restaurants/RestaurantDetailsForm';

type BookingRulesDetails = {
  name: string;
  slug: string | null;
  timezone: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  managerDailySummaryEnabled: boolean;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
};

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: COMMON_TIMEZONES[0],
  contactEmail: null,
  contactPhone: null,
  address: null,
  businessDescription: null,
  managerName: null,
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

export function toBookingRulesFormValues(
  data: BookingRulesDetails | null | undefined,
): RestaurantDetailsFormValues {
  if (!data) {
    return EMPTY_VALUES;
  }

  return {
    name: data.name,
    slug: data.slug ?? '',
    timezone: data.timezone ?? COMMON_TIMEZONES[0],
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    address: data.address,
    businessDescription: data.businessDescription,
    // Manager name is edited on the profile notifications subform, not booking rules.
    managerName: null,
    managerDailySummaryEnabled: data.managerDailySummaryEnabled,
    managerNotificationPhone: data.managerNotificationPhone,
    googleMapUrl: data.googleMapUrl,
    googleReviewUrl: data.googleReviewUrl,
    bookingPolicy: data.bookingPolicy,
    reservationIntervalMinutes: data.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: data.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: data.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: data.reservationLifecycleGraceMinutes,
  };
}
