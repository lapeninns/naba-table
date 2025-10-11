import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export type UpdateRestaurantInput = {
  name?: string;
  slug?: string;
  timezone?: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  bookingPolicy?: string | null;
};

export type UpdatedRestaurant = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function updateRestaurant(
  restaurantId: string,
  input: UpdateRestaurantInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<UpdatedRestaurant> {
  if (Object.keys(input).length === 0) {
    throw new Error('No fields to update');
  }

  const updateData: Record<string, any> = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.slug !== undefined) {
    const { data: existingSlug, error: slugCheckError } = await client
      .from('restaurants')
      .select('id')
      .eq('slug', input.slug)
      .neq('id', restaurantId)
      .maybeSingle();

    if (slugCheckError) {
      throw new Error(`Failed to check slug uniqueness: ${slugCheckError.message}`);
    }

    if (existingSlug) {
      throw new Error('Slug is already in use by another restaurant');
    }

    updateData.slug = input.slug;
  }

  if (input.timezone !== undefined) {
    updateData.timezone = input.timezone;
  }

  if (input.capacity !== undefined) {
    updateData.capacity = input.capacity;
  }

  if (input.contactEmail !== undefined) {
    updateData.contact_email = input.contactEmail;
  }

  if (input.contactPhone !== undefined) {
    updateData.contact_phone = input.contactPhone;
  }

  if (input.address !== undefined) {
    updateData.address = input.address;
  }

  if (input.bookingPolicy !== undefined) {
    updateData.booking_policy = input.bookingPolicy;
  }

  const { data, error } = await client
    .from('restaurants')
    .update(updateData)
    .eq('id', restaurantId)
    .select(
      'id, name, slug, timezone, capacity, contact_email, contact_phone, address, booking_policy, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('[updateRestaurant] Update failed', error);
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }

  if (!data) {
    throw new Error('Restaurant not found');
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    capacity: data.capacity,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    address: data.address,
    bookingPolicy: data.booking_policy,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
