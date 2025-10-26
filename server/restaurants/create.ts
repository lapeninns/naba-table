import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';



type DbClient = SupabaseClient<Database, 'public', any>;

export type CreateRestaurantInput = {
  name: string;
  slug?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  bookingPolicy?: string | null;
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
};

export type CreatedRestaurant = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  createdAt: string;
  updatedAt: string;
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureUniqueSlug(slug: string, client: DbClient): Promise<string> {
  let candidateSlug = slug;
  let attempt = 0;

  while (attempt < 10) {
    const { data, error } = await client
      .from('restaurants')
      .select('id')
      .eq('slug', candidateSlug)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check slug uniqueness: ${error.message}`);
    }

    if (!data) {
      return candidateSlug;
    }

    attempt += 1;
    candidateSlug = `${slug}-${attempt}`;
  }

  throw new Error('Unable to generate unique slug after multiple attempts');
}

export async function createRestaurant(
  input: CreateRestaurantInput,
  userId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<CreatedRestaurant> {
  const slug = input.slug || generateSlug(input.name);
  const uniqueSlug = await ensureUniqueSlug(slug, client);
  const timezone = assertValidTimezone(input.timezone);
  const intervalMinutes =
    input.reservationIntervalMinutes !== undefined ? input.reservationIntervalMinutes : 15;
  const defaultDurationMinutes =
    input.reservationDefaultDurationMinutes !== undefined
      ? input.reservationDefaultDurationMinutes
      : 90;
  const lastSeatingBufferMinutes = input.reservationLastSeatingBufferMinutes;

  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 180) {
    throw new Error('Reservation interval must be an integer between 1 and 180 minutes.');
  }

  if (!Number.isInteger(defaultDurationMinutes) || defaultDurationMinutes < 15 || defaultDurationMinutes > 300) {
    throw new Error('Reservation duration must be an integer between 15 and 300 minutes.');
  }

  if (
    lastSeatingBufferMinutes !== undefined &&
    (!Number.isInteger(lastSeatingBufferMinutes) ||
      lastSeatingBufferMinutes < 15 ||
      lastSeatingBufferMinutes > 300)
  ) {
    throw new Error('Last seating buffer must be an integer between 15 and 300 minutes.');
  }

  const insertPayload: Database['public']['Tables']['restaurants']['Insert'] = {
    name: input.name,
    slug: uniqueSlug,
    timezone,
    capacity: input.capacity ?? null,
    contact_email: input.contactEmail ?? null,
    contact_phone: input.contactPhone ?? null,
    address: input.address ?? null,
    booking_policy: input.bookingPolicy ?? null,
    reservation_interval_minutes: intervalMinutes,
    reservation_default_duration_minutes: defaultDurationMinutes,
    ...(lastSeatingBufferMinutes !== undefined
      ? { reservation_last_seating_buffer_minutes: lastSeatingBufferMinutes }
      : {}),
  };

  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .insert(insertPayload)
    .select(
      'id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes, created_at, updated_at',
    )
    .single();

  if (restaurantError) {
    console.error('[createRestaurant] Insert failed', restaurantError);
    throw new Error(`Failed to create restaurant: ${restaurantError.message}`);
  }

  if (!restaurant) {
    throw new Error('Restaurant creation returned no data');
  }

  const { error: membershipError } = await client.from('restaurant_memberships').insert({
    user_id: userId,
    restaurant_id: restaurant.id,
    role: 'owner',
  });

  if (membershipError) {
    console.error('[createRestaurant] Membership creation failed', membershipError);
    await client.from('restaurants').delete().eq('id', restaurant.id);
    throw new Error(`Failed to create restaurant membership: ${membershipError.message}`);
  }

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    timezone: restaurant.timezone,
    capacity: restaurant.capacity,
    contactEmail: restaurant.contact_email,
    contactPhone: restaurant.contact_phone,
    address: restaurant.address,
    bookingPolicy: restaurant.booking_policy,
    reservationIntervalMinutes: restaurant.reservation_interval_minutes,
    reservationDefaultDurationMinutes: restaurant.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: restaurant.reservation_last_seating_buffer_minutes,
    createdAt: restaurant.created_at,
    updatedAt: restaurant.updated_at,
  };
}
