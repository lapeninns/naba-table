import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type RestaurantUpdate = Database['public']['Tables']['restaurants']['Update'];
type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', 'public', PublicSchema>;

export type UpdateRestaurantInput = {
  name?: string;
  slug?: string;
  isActive?: boolean;
  timezone?: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  managerDailySummaryEnabled?: boolean;
  managerName?: string | null;
  managerNotificationPhone?: string | null;
  googleMapUrl?: string | null;
  googleReviewUrl?: string | null;
  bookingPolicy?: string | null;
  logoUrl?: string | null;
  emailSendReminder24h?: boolean;
  emailSendReminderShort?: boolean;
  emailSendReviewRequest?: boolean;
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
  reservationLifecycleGraceMinutes?: number;
};

export type UpdatedRestaurant = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  managerDailySummaryEnabled: boolean;
  managerName: string | null;
  managerNotificationPhone: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
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

  const updateData: RestaurantUpdate = {};

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

  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive;
  }

  if (input.timezone !== undefined) {
    updateData.timezone = assertValidTimezone(input.timezone);
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

  if (input.managerNotificationPhone !== undefined) {
    const trimmed = input.managerNotificationPhone?.trim();
    updateData.manager_notification_phone = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (input.managerName !== undefined) {
    const trimmed = input.managerName?.trim();
    updateData.manager_name = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (input.managerDailySummaryEnabled !== undefined) {
    updateData.manager_daily_summary_enabled = input.managerDailySummaryEnabled;
  }

  if (
    updateData.manager_daily_summary_enabled === true &&
    updateData.manager_notification_phone === undefined
  ) {
    const { data: currentRow, error: currentError } = await client
      .from('restaurants')
      .select('manager_notification_phone')
      .eq('id', restaurantId)
      .maybeSingle<{ manager_notification_phone: string | null }>();

    if (currentError) {
      throw new Error(`Failed to load current manager notification phone: ${currentError.message}`);
    }

    updateData.manager_notification_phone = currentRow?.manager_notification_phone ?? null;
  }

  if (updateData.manager_notification_phone === null) {
    updateData.manager_daily_summary_enabled = false;
  }

  if (updateData.manager_daily_summary_enabled === true && !updateData.manager_notification_phone) {
    throw new Error(
      'A manager notification phone is required when daily SMS summaries are enabled.',
    );
  }

  if (input.googleMapUrl !== undefined) {
    updateData.google_map_url = safeGoogleMapsUrl(input.googleMapUrl);
  }

  if (input.googleReviewUrl !== undefined) {
    updateData.google_review_url = safeGoogleReviewUrl(input.googleReviewUrl);
  }

  if (input.bookingPolicy !== undefined) {
    updateData.booking_policy = input.bookingPolicy;
  }

  if (input.logoUrl !== undefined) {
    const trimmed = input.logoUrl?.trim();
    updateData.logo_url = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  if (input.reservationIntervalMinutes !== undefined) {
    const value = input.reservationIntervalMinutes;
    if (!Number.isInteger(value) || value < 1 || value > 180) {
      throw new Error('Reservation interval must be an integer between 1 and 180 minutes.');
    }
    updateData.reservation_interval_minutes = value;
  }

  if (input.reservationDefaultDurationMinutes !== undefined) {
    const value = input.reservationDefaultDurationMinutes;
    if (!Number.isInteger(value) || value < 15 || value > 300) {
      throw new Error('Reservation duration must be an integer between 15 and 300 minutes.');
    }
    updateData.reservation_default_duration_minutes = value;
  }

  if (input.reservationLastSeatingBufferMinutes !== undefined) {
    const value = input.reservationLastSeatingBufferMinutes;
    if (!Number.isInteger(value) || value < 15 || value > 300) {
      throw new Error('Last seating buffer must be an integer between 15 and 300 minutes.');
    }
    updateData.reservation_last_seating_buffer_minutes = value;
  }

  if (input.reservationLifecycleGraceMinutes !== undefined) {
    const value = input.reservationLifecycleGraceMinutes;
    if (!Number.isInteger(value) || value < 0 || value > 120) {
      throw new Error('Lifecycle grace period must be an integer between 0 and 120 minutes.');
    }
    updateData.reservation_lifecycle_grace_minutes = value;
  }

  if (input.emailSendReminder24h !== undefined) {
    updateData.email_send_reminder_24h = input.emailSendReminder24h;
  }

  if (input.emailSendReminderShort !== undefined) {
    updateData.email_send_reminder_short = input.emailSendReminderShort;
  }

  if (input.emailSendReviewRequest !== undefined) {
    updateData.email_send_review_request = input.emailSendReviewRequest;
  }

  const runUpdate = (includeLogo: boolean, payload: RestaurantUpdate) =>
    client
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId)
      .select(restaurantSelectColumns(includeLogo))
      .single<RestaurantRow>();

  let { data, error } = await runUpdate(true, updateData);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('updateRestaurant');
    const fallbackPayload: RestaurantUpdate = { ...updateData };
    delete fallbackPayload.logo_url;
    ({ data, error } = await runUpdate(false, fallbackPayload));
    data = ensureLogoColumnOnRow(data);
  }

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
    isActive: data.is_active ?? true,
    timezone: data.timezone,
    capacity: data.capacity,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    address: data.address,
    managerDailySummaryEnabled: data.manager_daily_summary_enabled ?? false,
    managerName: data.manager_name,
    managerNotificationPhone: data.manager_notification_phone,
    googleMapUrl: safeGoogleMapsUrl(data.google_map_url),
    googleReviewUrl: safeGoogleReviewUrl(data.google_review_url),
    bookingPolicy: data.booking_policy,
    logoUrl: data.logo_url,
    emailSendReminder24h: data.email_send_reminder_24h ?? true,
    emailSendReminderShort: data.email_send_reminder_short ?? true,
    emailSendReviewRequest: data.email_send_review_request ?? true,
    reservationIntervalMinutes: data.reservation_interval_minutes,
    reservationDefaultDurationMinutes: data.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: data.reservation_last_seating_buffer_minutes,
    reservationLifecycleGraceMinutes:
      data.reservation_lifecycle_grace_minutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
