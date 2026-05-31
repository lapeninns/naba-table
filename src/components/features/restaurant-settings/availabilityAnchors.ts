export const AVAILABILITY_ANCHORS = {
  bookingRules: 'booking-rules',
  weeklyHours: 'weekly-hours',
  serviceWindows: 'service-windows',
  dateOverrides: 'date-overrides',
  bookingOccasions: 'booking-occasions',
  availabilitySchedule: 'availability-schedule',
} as const;

export type AvailabilityAnchor = (typeof AVAILABILITY_ANCHORS)[keyof typeof AVAILABILITY_ANCHORS];

export function availabilityHash(anchor: AvailabilityAnchor): `#${AvailabilityAnchor}` {
  return `#${anchor}`;
}
