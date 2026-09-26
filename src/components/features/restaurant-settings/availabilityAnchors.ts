/**
 * Deep-link anchors on the Availability page. `availabilitySchedule` and `serviceWindows` are kept
 * for links made before the page became one scrolling page; both open Weekly hours.
 */
export const AVAILABILITY_ANCHORS = {
  bookingRules: 'booking-rules',
  weeklyHours: 'weekly-hours',
  serviceWindows: 'service-windows',
  specialDates: 'special-dates',
  bookingOccasions: 'booking-occasions',
  availabilitySchedule: 'availability-schedule',
} as const;

export type AvailabilityAnchor = (typeof AVAILABILITY_ANCHORS)[keyof typeof AVAILABILITY_ANCHORS];

export function availabilityHash(anchor: AvailabilityAnchor): `#${AvailabilityAnchor}` {
  return `#${anchor}`;
}
