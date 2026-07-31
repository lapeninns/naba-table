import { createHash } from 'node:crypto';

import { getRestaurantDetails } from '@/server/restaurants/details';
import {
  getOperatingHours,
  type OperatingHoursSnapshot,
} from '@/server/restaurants/operatingHours';
import {
  getServicePeriods,
  type ServicePeriod,
} from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantDetails } from '@/server/restaurants/details';

export type VenuePresenceProjectionV1 = {
  schemaVersion: 'VenuePresenceProjectionV1';
  restaurantId: string;
  revision: string;
  generatedAt: string;
  profile: {
    name: string;
    description: string | null;
    phone: string | null;
    website: string | null;
    structuredAddress: { formatted: string } | null;
    timezone: string;
  };
  hours: {
    regular: Array<{
      dayOfWeek: number;
      opensAt: string | null;
      closesAt: string | null;
      isClosed: boolean;
    }>;
    special: Array<{
      effectiveDate: string;
      opensAt: string | null;
      closesAt: string | null;
      isClosed: boolean;
    }>;
    moreHours: Array<never>;
    servicePeriods: Array<{
      stableKey: string;
      name: string;
      dayOfWeek: number | null;
      startTime: string;
      endTime: string;
      bookingOption: string;
    }>;
  };
  links: {
    bookingUrl: string | null;
    mapsUrl: string | null;
    reviewUrl: string | null;
  };
  menu: null;
  media: Array<never>;
  lodging: null;
};

type ProjectionInput = {
  generatedAt?: string;
  profile: RestaurantDetails;
  operatingHours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriod[];
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function latestRevisionTimestamp(input: ProjectionInput): string {
  return [
    input.profile.updatedAt,
    input.operatingHours.updatedAt,
    ...input.servicePeriods.map((period) => period.updatedAt),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? '1970-01-01T00:00:00.000Z';
}

export function buildVenuePresenceProjection(input: ProjectionInput): {
  projection: VenuePresenceProjectionV1;
  etag: string;
} {
  const publicContent = {
    restaurantId: input.profile.restaurantId,
    profile: {
      name: input.profile.name,
      description: input.profile.businessDescription,
      phone: input.profile.contactPhone,
      website: null,
      structuredAddress: input.profile.address
        ? { formatted: input.profile.address }
        : null,
      timezone: input.profile.timezone,
    },
    hours: {
      regular: input.operatingHours.weekly
        .map((row) => ({
          dayOfWeek: row.dayOfWeek,
          opensAt: row.isClosed ? null : row.opensAt,
          closesAt: row.isClosed ? null : row.closesAt,
          isClosed: row.isClosed,
        }))
        .sort((left, right) => left.dayOfWeek - right.dayOfWeek),
      special: input.operatingHours.overrides
        .map((row) => ({
          effectiveDate: row.effectiveDate,
          opensAt: row.isClosed ? null : row.opensAt,
          closesAt: row.isClosed ? null : row.closesAt,
          isClosed: row.isClosed,
        }))
        .sort((left, right) =>
          left.effectiveDate.localeCompare(right.effectiveDate),
        ),
      moreHours: [] as Array<never>,
      servicePeriods: input.servicePeriods
        .map((period) => ({
          stableKey: `${period.dayOfWeek ?? 'all'}:${period.bookingOption
            .trim()
            .toLowerCase()}`,
          name: period.name,
          dayOfWeek: period.dayOfWeek,
          startTime: period.startTime,
          endTime: period.endTime,
          bookingOption: period.bookingOption,
        }))
        .sort((left, right) =>
          left.stableKey.localeCompare(right.stableKey),
        ),
    },
    links: {
      bookingUrl: null,
      mapsUrl: input.profile.googleMapUrl,
      reviewUrl: input.profile.googleReviewUrl,
    },
    menu: null,
    media: [] as Array<never>,
    lodging: null,
  };
  const contentHash = createHash('sha256')
    .update(canonicalJson(publicContent))
    .digest('hex');
  const revision = `${latestRevisionTimestamp(input)}:${contentHash.slice(0, 16)}`;
  const projection: VenuePresenceProjectionV1 = {
    schemaVersion: 'VenuePresenceProjectionV1',
    revision,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    ...publicContent,
  };
  const etag = `"${createHash('sha256')
    .update(canonicalJson(projection))
    .digest('hex')}"`;

  return { projection, etag };
}

export async function getVenuePresenceProjection(
  restaurantId: string,
): Promise<ReturnType<typeof buildVenuePresenceProjection>> {
  const client = getServiceSupabaseClient();
  const [profile, operatingHours, servicePeriods] = await Promise.all([
    getRestaurantDetails(restaurantId, client),
    getOperatingHours(restaurantId, client),
    getServicePeriods(restaurantId, client),
  ]);
  return buildVenuePresenceProjection({
    profile,
    operatingHours,
    servicePeriods,
  });
}

export type PresenceRestaurantCandidate = {
  restaurantId: string;
  name: string;
  address: string | null;
  timezone: string;
  googleLocationName: string | null;
  googleLocationTitle: string | null;
};

export async function listPresenceRestaurantCandidates(): Promise<
  PresenceRestaurantCandidate[]
> {
  const client = getServiceSupabaseClient();
  const [{ data: restaurants, error: restaurantError }, { data: profiles, error: profileError }] =
    await Promise.all([
      client
        .from('restaurants')
        .select('id, name, address, timezone')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      client
        .from('restaurant_external_profiles')
        .select(
          'restaurant_id, external_location_name, external_location_title',
        )
        .eq('provider', 'google_business_profile'),
    ]);
  if (restaurantError) throw restaurantError;
  if (profileError) throw profileError;

  const profileByRestaurant = new Map(
    (profiles ?? []).map((profile) => [profile.restaurant_id, profile]),
  );
  return (restaurants ?? []).map((restaurant) => {
    const profile = profileByRestaurant.get(restaurant.id);
    return {
      restaurantId: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      timezone: restaurant.timezone,
      googleLocationName: profile?.external_location_name ?? null,
      googleLocationTitle: profile?.external_location_title ?? null,
    };
  });
}
