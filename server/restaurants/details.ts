import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import { updateRestaurant } from './update';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export type RestaurantDetails = {
  restaurantId: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
};

export type UpdateRestaurantDetailsInput = {
  name?: string;
  slug?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  bookingPolicy?: string | null;
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
  bookingPolicy: string | null;
};

function validateDetailsInput(input: NormalizedDetailsInput): NormalizedDetailsInput {
  const timezone = input.timezone.trim();
  if (!timezone) {
    throw new Error('Timezone is required');
  }

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
    bookingPolicy: sanitizeString(input.bookingPolicy),
  };
}

export async function getRestaurantDetails(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantDetails> {
  const { data, error } = await client
    .from('restaurants')
    .select('id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  return {
    restaurantId: data.id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    capacity: data.capacity,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    address: data.address,
    bookingPolicy: data.booking_policy,
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
    bookingPolicy: input.bookingPolicy ?? current.bookingPolicy,
  };

  const validated = validateDetailsInput(merged);
  const updated = await updateRestaurant(restaurantId, validated, client);

  return {
    restaurantId: updated.id,
    name: updated.name,
    slug: updated.slug,
    timezone: updated.timezone,
    capacity: updated.capacity,
    contactEmail: updated.contactEmail,
    contactPhone: updated.contactPhone,
    address: updated.address,
    bookingPolicy: updated.bookingPolicy,
  };
}
