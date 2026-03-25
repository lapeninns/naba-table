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
  logoUrl?: string | null;
  isActive?: boolean | null;
  reservationIntervalMinutes?: number | null;
  reservationDefaultDurationMinutes?: number | null;
  reservationLastSeatingBufferMinutes?: number | null;
  reservationLifecycleGraceMinutes?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RestaurantFilters {
  search?: string;
  timezone?: string;
  minCapacity?: number;
  fixture?: string;
}
