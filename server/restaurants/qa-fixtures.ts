import type { RestaurantFilters, RestaurantSummary } from '@/lib/restaurants/types';

export const QA_PUBLIC_BOOKING_RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
export const QA_PUBLIC_BOOKING_RESTAURANT_SLUG = 'qa-public-booking';

const QA_RESTAURANT_FIXTURES: RestaurantSummary[] = [
  {
    address: '1 QA High Street, London',
    bookingPolicy: 'QA fixture bookings are mocked and never sent to a real venue.',
    capacity: 24,
    contactEmail: 'qa-restaurant@example.test',
    contactPhone: '+441234567890',
    createdAt: '2026-05-16T00:00:00.000Z',
    googleMapUrl: null,
    id: QA_PUBLIC_BOOKING_RESTAURANT_ID,
    isActive: true,
    logoUrl: null,
    name: 'QA Public Booking Restaurant',
    reservationDefaultDurationMinutes: 90,
    reservationIntervalMinutes: 15,
    reservationLastSeatingBufferMinutes: 0,
    reservationLifecycleGraceMinutes: 15,
    slug: QA_PUBLIC_BOOKING_RESTAURANT_SLUG,
    timezone: 'Europe/London',
    updatedAt: '2026-05-16T00:00:00.000Z',
  },
];

function qaRestaurantFixturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.QA_USE_MOCKS === '1' || env.QA_USE_MOCKS === 'true';
}

export function getQaRestaurantFixtureBySlug(
  slug: string,
  env: NodeJS.ProcessEnv = process.env,
): RestaurantSummary | null {
  if (!qaRestaurantFixturesEnabled(env)) {
    return null;
  }

  const normalized = slug.trim().toLowerCase();
  return QA_RESTAURANT_FIXTURES.find((restaurant) => restaurant.slug === normalized) ?? null;
}

export function listQaRestaurantFixtures(
  filters: RestaurantFilters = {},
  env: NodeJS.ProcessEnv = process.env,
): RestaurantSummary[] | null {
  if (!qaRestaurantFixturesEnabled(env)) {
    return null;
  }

  const normalizedSearch = filters.search?.trim().toLowerCase();
  return QA_RESTAURANT_FIXTURES.filter((restaurant) => {
    if (normalizedSearch && !restaurant.name.toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    if (
      filters.timezone &&
      filters.timezone !== 'all' &&
      restaurant.timezone !== filters.timezone
    ) {
      return false;
    }

    if (
      typeof filters.minCapacity === 'number' &&
      Number.isFinite(filters.minCapacity) &&
      (restaurant.capacity ?? 0) < filters.minCapacity
    ) {
      return false;
    }

    return true;
  });
}
