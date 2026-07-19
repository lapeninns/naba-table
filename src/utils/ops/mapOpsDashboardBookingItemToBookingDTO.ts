import { toBookingUtcIso } from '@reserve/shared/formatting/bookingDateTime';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsDashboardBookingItem } from '@/types/ops';

export function mapOpsDashboardBookingItemToBookingDTO(
  booking: OpsDashboardBookingItem,
  context: {
    restaurantId: string;
    restaurantName: string;
    restaurantSlug: string | null;
    restaurantTimezone: string;
    summaryDate: string;
  },
): BookingDTO {
  const fallbackIso =
    toBookingUtcIso(context.summaryDate, '00:00', context.restaurantTimezone) ??
    `${context.summaryDate}T00:00:00Z`;

  return {
    id: booking.id,
    restaurantId: context.restaurantId,
    restaurantName: context.restaurantName,
    restaurantSlug: context.restaurantSlug,
    restaurantTimezone: context.restaurantTimezone,
    partySize: booking.partySize,
    startIso: booking.startIso ?? fallbackIso,
    endIso: booking.endIso ?? booking.startIso ?? fallbackIso,
    status: booking.status,
    notes: booking.notes ?? null,
    customerName: booking.customerName ?? null,
    customerEmail: booking.customerEmail ?? null,
    customerPhone: booking.customerPhone ?? null,
    reference: booking.reference ?? null,
    source: booking.source ?? null,
    details: booking.details ?? null,
    seatingPreference: booking.seatingPreference ?? null,
    allergies: booking.allergies ?? null,
    dietaryRestrictions: booking.dietaryRestrictions ?? null,
    tableAssignments: booking.tableAssignments ?? undefined,
    requiresTableAssignment: booking.requiresTableAssignment,
    checkedInAt: booking.checkedInAt ?? null,
    checkedOutAt: booking.checkedOutAt ?? null,
    displayTimeRangeLabel: booking.displayTimeRangeLabel ?? null,
    displayCustomerLabel: booking.displayCustomerLabel ?? null,
    displayInitials: booking.displayInitials ?? null,
    searchText: booking.searchText ?? null,
    tableLabel: booking.tableLabel ?? null,
  };
}
