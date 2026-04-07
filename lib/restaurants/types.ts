import type { RestaurantGoogleBusinessProfileNormalized } from './google-business-profile';

export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  address?: string | null;
  bookingPolicy?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  googleMapUrl?: string | null;
  googleReviewUrl?: string | null;
  logoUrl?: string | null;
  isActive?: boolean | null;
  reservationIntervalMinutes?: number | null;
  reservationDefaultDurationMinutes?: number | null;
  reservationLastSeatingBufferMinutes?: number | null;
  reservationLifecycleGraceMinutes?: number | null;
  createdAt?: string;
  updatedAt?: string;
  googleBusinessProfile?: RestaurantGoogleBusinessProfileNormalized | null;
}

export interface RestaurantFilters {
  search?: string;
  timezone?: string;
  minCapacity?: number;
}
