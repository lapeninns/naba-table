import { getTodayInTimezone } from '@/lib/utils/datetime';

import type { OpsBookingStatus } from '@/types/ops';

export const OPS_TABLE_ASSIGNMENT_ALLOWED_STATUSES = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'PRIORITY_WAITLIST',
] as const satisfies readonly OpsBookingStatus[];

export function isTableAssignmentStatusAllowed(
  status: OpsBookingStatus | null | undefined,
): boolean {
  if (!status) return false;
  return OPS_TABLE_ASSIGNMENT_ALLOWED_STATUSES.includes(status);
}

export function isTableAssignmentDateAllowed(params: {
  bookingDate: string | null | undefined;
  timezone: string;
}): boolean {
  const { bookingDate, timezone } = params;
  if (!bookingDate) return false;
  const today = getTodayInTimezone(timezone);
  return bookingDate >= today;
}

export function isTableAssignmentAllowed(params: {
  status: OpsBookingStatus | null | undefined;
  bookingDate: string | null | undefined;
  timezone: string;
}): boolean {
  const { status, bookingDate, timezone } = params;
  return isTableAssignmentStatusAllowed(status) && isTableAssignmentDateAllowed({ bookingDate, timezone });
}
