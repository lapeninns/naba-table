import type { RestaurantDTO } from '../schema';
import type { UpdatedRestaurant } from '@/server/restaurants/update';

/** The canonical restaurant body returned by the profile PATCH and the logo routes. */
export function toRestaurantDto(
  restaurant: UpdatedRestaurant,
  role: RestaurantDTO['role'],
): RestaurantDTO {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    isActive: restaurant.isActive ?? true,
    timezone: restaurant.timezone,
    capacity: restaurant.capacity,
    contactEmail: restaurant.contactEmail,
    contactPhone: restaurant.contactPhone,
    address: restaurant.address,
    businessDescription: restaurant.businessDescription,
    managerDailySummaryEnabled: restaurant.managerDailySummaryEnabled,
    managerWhatsappEnabled: restaurant.managerWhatsappEnabled,
    managerName: restaurant.managerName,
    managerNotificationPhone: restaurant.managerNotificationPhone,
    googleMapUrl: restaurant.googleMapUrl,
    googleReviewUrl: restaurant.googleReviewUrl,
    bookingPolicy: restaurant.bookingPolicy,
    logoUrl: restaurant.logoUrl,
    emailSendReminder24h: restaurant.emailSendReminder24h,
    emailSendReminderShort: restaurant.emailSendReminderShort,
    emailSendReviewRequest: restaurant.emailSendReviewRequest,
    reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
    reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
    reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
    reservationLifecycleGraceMinutes: restaurant.reservationLifecycleGraceMinutes,
    createdAt: restaurant.createdAt,
    updatedAt: restaurant.updatedAt,
    role,
  };
}
