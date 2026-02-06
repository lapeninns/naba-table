import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingListItem } from '@/types/ops';

export function mapOpsBookingListItemToBookingDTO(
  booking: OpsBookingListItem,
  fallbackRestaurantSlug: string | null,
): BookingDTO {
  return {
    id: booking.id,
    restaurantId: booking.restaurantId ?? null,
    restaurantName: booking.restaurantName,
    restaurantSlug: booking.restaurantSlug ?? fallbackRestaurantSlug ?? null,
    restaurantTimezone: booking.restaurantTimezone ?? null,
    partySize: booking.partySize,
    startIso: booking.startIso,
    endIso: booking.endIso,
    status: booking.status,
    notes: booking.notes ?? null,
    customerName: booking.customerName ?? null,
    customerEmail: booking.customerEmail ?? null,
    customerPhone: booking.customerPhone ?? null,
    reservationIntervalMinutes: booking.reservationIntervalMinutes ?? null,
    reference: booking.reference ?? null,
    source: booking.source ?? null,
    loyaltyTier: booking.loyaltyTier ?? null,
    loyaltyPoints: booking.loyaltyPoints ?? null,
    seatingPreference: booking.seatingPreference ?? null,
    allergies: booking.allergies ?? null,
    dietaryRestrictions: booking.dietaryRestrictions ?? null,
    tableAssignments: booking.tableAssignments ?? undefined,
    requiresTableAssignment: booking.requiresTableAssignment ?? undefined,
    checkedInAt: booking.checkedInAt ?? null,
    checkedOutAt: booking.checkedOutAt ?? null,
  };
}

