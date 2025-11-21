import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import { updateRestaurant } from './update';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type DbClient = SupabaseClient<Database>;

export type RestaurantDetails = {
  restaurantId: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  googleMapUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
};

export type UpdateRestaurantDetailsInput = {
  name?: string;
  slug?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  googleMapUrl?: string | null;
  bookingPolicy?: string | null;
  logoUrl?: string | null;
};

function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type NormalizedDetailsInput = {
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  googleMapUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
};

function validateDetailsInput(input: NormalizedDetailsInput): NormalizedDetailsInput {
  const timezone = assertValidTimezone(input.timezone);

  const name = input.name.trim();
  if (!name) {
    throw new Error('Name is required');
  }

  const slug = input.slug.trim();
  if (!slug) {
    throw new Error('Slug is required');
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens');
  }

  const capacity = input.capacity === null ? null : Number.isFinite(input.capacity) ? input.capacity : null;
  if (capacity !== null && capacity < 0) {
    throw new Error('Capacity must be a positive number');
  }

  return {
    name,
    slug,
    timezone,
    capacity,
    contactEmail: sanitizeString(input.contactEmail),
    contactPhone: sanitizeString(input.contactPhone),
    address: sanitizeString(input.address),
    googleMapUrl: sanitizeString(input.googleMapUrl),
    bookingPolicy: sanitizeString(input.bookingPolicy),
    logoUrl: sanitizeString(input.logoUrl),
  };
}

export async function getRestaurantDetails(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const execute = (includeLogo: boolean) =>
    client
      .from('restaurants')
      .select(restaurantSelectColumns(includeLogo))
      .eq('id', restaurantId)
      .maybeSingle<RestaurantRow>();

  let { data, error } = await execute(true);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('getRestaurantDetails');
    ({ data, error } = await execute(false));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  const restaurant = ensureLogoColumnOnRow(data);
  return {
    restaurantId: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    timezone: restaurant.timezone,
    capacity: restaurant.capacity,
    contactEmail: restaurant.contact_email,
    contactPhone: restaurant.contact_phone,
    address: restaurant.address,
    googleMapUrl: restaurant.google_map_url,
    bookingPolicy: restaurant.booking_policy,
    logoUrl: restaurant.logo_url,
  };
}

export async function updateRestaurantDetails(
  restaurantId: string,
  input: UpdateRestaurantDetailsInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const current = await getRestaurantDetails(restaurantId, client);
  const merged: NormalizedDetailsInput = {
    name: input.name ?? current.name,
    slug: input.slug ?? current.slug,
    timezone: input.timezone ?? current.timezone,
    capacity: input.capacity ?? current.capacity,
    contactEmail: input.contactEmail ?? current.contactEmail,
    contactPhone: input.contactPhone ?? current.contactPhone,
    address: input.address ?? current.address,
    googleMapUrl: input.googleMapUrl ?? current.googleMapUrl,
    bookingPolicy: input.bookingPolicy ?? current.bookingPolicy,
    logoUrl: input.logoUrl ?? current.logoUrl,
  };

  const validated = validateDetailsInput(merged);
  const payload =
    validated.googleMapUrl === null ? (({ googleMapUrl: _googleMapUrl, ...rest }) => rest)(validated) : validated;
  const updated = await updateRestaurant(restaurantId, payload, client);

  return {
    restaurantId: updated.id,
    name: updated.name,
    slug: updated.slug,
    timezone: updated.timezone,
    capacity: updated.capacity,
    contactEmail: updated.contactEmail,
    contactPhone: updated.contactPhone,
    address: updated.address,
    googleMapUrl: updated.googleMapUrl,
    bookingPolicy: updated.bookingPolicy,
    logoUrl: updated.logoUrl,
  };
}
