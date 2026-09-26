import { randomBytes } from 'node:crypto';

import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  RestaurantAccessExistsError,
  RestaurantCreateValidationError,
  RestaurantSlugUnavailableError,
} from '@/server/restaurants/create-errors';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', 'public', PublicSchema>;

type CreateRestaurantWithOwnerArgs = {
  p_address: string | null;
  p_booking_policy: string | null;
  p_capacity: number | null;
  p_contact_email: string | null;
  p_contact_phone: string | null;
  p_email_send_reminder_24h: boolean;
  p_email_send_reminder_short: boolean;
  p_email_send_review_request: boolean;
  p_google_map_url: string | null;
  p_google_review_url: string | null;
  p_logo_url: string | null;
  p_manager_daily_summary_enabled: boolean;
  p_manager_notification_phone: string | null;
  p_name: string;
  p_reservation_default_duration_minutes: number;
  p_reservation_interval_minutes: number;
  p_reservation_last_seating_buffer_minutes: number | null;
  p_reservation_lifecycle_grace_minutes: number;
  p_slug: string;
  p_timezone: string;
  p_user_id: string;
};

type RpcError = { message: string; code?: string; details?: string | null };

type CreateRestaurantWithOwnerRpcClient = DbClient & {
  rpc: (
    fn: 'create_restaurant_with_owner',
    args: CreateRestaurantWithOwnerArgs,
  ) => Promise<{
    data: RestaurantRow | null;
    error: RpcError | null;
  }>;
};

export type CreateRestaurantInput = {
  name: string;
  slug?: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  managerDailySummaryEnabled?: boolean;
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

export type CreatedRestaurant = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  managerDailySummaryEnabled: boolean;
  managerWhatsappEnabled: boolean;
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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const SLUG_FALLBACK = 'restaurant';
/** The first candidate is the requested slug; later ones add a random suffix. */
const MAX_SLUG_ATTEMPTS = 4;
const SLUG_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSlugSuffix(): string {
  const bytes = randomBytes(4);
  let suffix = '';
  for (const byte of bytes) {
    suffix += SLUG_SUFFIX_ALPHABET[byte % SLUG_SUFFIX_ALPHABET.length];
  }
  return suffix;
}

function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
}

function isSlugUniqueViolation(error: RpcError): boolean {
  if (error.code !== '23505') return false;
  const text = `${error.message} ${error.details ?? ''}`;
  return text.includes('restaurants_slug_key') || /\(slug\)=/.test(text);
}

function isExistingMembershipViolation(error: RpcError): boolean {
  return error.code === '23505' && error.message.includes('User already has restaurant access');
}

export async function createRestaurant(
  input: CreateRestaurantInput,
  userId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<CreatedRestaurant> {
  const baseSlug = input.slug || generateSlug(input.name) || SLUG_FALLBACK;
  let timezone: string;
  try {
    timezone = assertValidTimezone(input.timezone);
  } catch {
    throw new RestaurantCreateValidationError('Choose a valid timezone.');
  }
  const intervalMinutes =
    input.reservationIntervalMinutes !== undefined
      ? input.reservationIntervalMinutes
      : DEFAULT_RESERVATION_INTERVAL_MINUTES;
  const defaultDurationMinutes =
    input.reservationDefaultDurationMinutes !== undefined
      ? input.reservationDefaultDurationMinutes
      : 90;
  const lastSeatingBufferMinutes = input.reservationLastSeatingBufferMinutes;
  const lifecycleGraceMinutes =
    input.reservationLifecycleGraceMinutes !== undefined
      ? input.reservationLifecycleGraceMinutes
      : 30;

  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 180) {
    throw new RestaurantCreateValidationError(
      'Reservation interval must be an integer between 1 and 180 minutes.',
    );
  }

  if (
    !Number.isInteger(defaultDurationMinutes) ||
    defaultDurationMinutes < 15 ||
    defaultDurationMinutes > 300
  ) {
    throw new RestaurantCreateValidationError(
      'Reservation duration must be an integer between 15 and 300 minutes.',
    );
  }

  if (
    lastSeatingBufferMinutes !== undefined &&
    (!Number.isInteger(lastSeatingBufferMinutes) ||
      lastSeatingBufferMinutes < 15 ||
      lastSeatingBufferMinutes > 300)
  ) {
    throw new RestaurantCreateValidationError(
      'Last seating buffer must be an integer between 15 and 300 minutes.',
    );
  }

  if (
    !Number.isInteger(lifecycleGraceMinutes) ||
    lifecycleGraceMinutes < 0 ||
    lifecycleGraceMinutes > 120
  ) {
    throw new RestaurantCreateValidationError(
      'Lifecycle grace period must be an integer between 0 and 120 minutes.',
    );
  }

  const managerNotificationPhone = input.managerNotificationPhone?.trim() || null;
  const managerDailySummaryEnabled = input.managerDailySummaryEnabled ?? false;
  const googleMapUrl = safeGoogleMapsUrl(input.googleMapUrl);
  const googleReviewUrl = safeGoogleReviewUrl(input.googleReviewUrl);

  if (managerDailySummaryEnabled && !managerNotificationPhone) {
    throw new RestaurantCreateValidationError(
      'A manager notification phone is required when daily SMS summaries are enabled.',
    );
  }

  // The slug is claimed by the unique index inside the atomic RPC; on a slug collision retry
  // with a suffixed candidate instead of probing with SELECTs first (one round trip when free).
  let restaurant: RestaurantRow | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = slugCandidate(baseSlug, attempt);
    const result = await (client as CreateRestaurantWithOwnerRpcClient).rpc(
      'create_restaurant_with_owner',
      {
        p_address: input.address ?? null,
        p_booking_policy: input.bookingPolicy ?? null,
        p_capacity: input.capacity ?? null,
        p_contact_email: input.contactEmail ?? null,
        p_contact_phone: input.contactPhone ?? null,
        p_email_send_reminder_24h: input.emailSendReminder24h ?? true,
        p_email_send_reminder_short: input.emailSendReminderShort ?? true,
        p_email_send_review_request: input.emailSendReviewRequest ?? true,
        p_google_map_url: googleMapUrl,
        p_google_review_url: googleReviewUrl,
        p_logo_url: input.logoUrl ?? null,
        p_manager_daily_summary_enabled: managerDailySummaryEnabled,
        p_manager_notification_phone: managerNotificationPhone,
        p_name: input.name,
        p_reservation_default_duration_minutes: defaultDurationMinutes,
        p_reservation_interval_minutes: intervalMinutes,
        p_reservation_last_seating_buffer_minutes: lastSeatingBufferMinutes ?? null,
        p_reservation_lifecycle_grace_minutes: lifecycleGraceMinutes,
        p_slug: slug,
        p_timezone: timezone,
        p_user_id: userId,
      },
    );

    if (!result.error) {
      restaurant = result.data;
      break;
    }
    if (isExistingMembershipViolation(result.error)) {
      throw new RestaurantAccessExistsError();
    }
    if (isSlugUniqueViolation(result.error)) {
      if (attempt === MAX_SLUG_ATTEMPTS - 1) {
        throw new RestaurantSlugUnavailableError();
      }
      continue;
    }
    console.error('[createRestaurant] Atomic creation failed', { code: result.error.code });
    throw new Error(`Failed to create restaurant: ${result.error.message}`);
  }

  if (!restaurant) {
    throw new Error('Restaurant creation returned no data');
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
    managerDailySummaryEnabled: restaurant.manager_daily_summary_enabled ?? false,
    managerWhatsappEnabled: false,
    managerName: restaurant.manager_name ?? null,
    managerNotificationPhone: restaurant.manager_notification_phone,
    googleMapUrl: safeGoogleMapsUrl(restaurant.google_map_url),
    googleReviewUrl: safeGoogleReviewUrl(restaurant.google_review_url),
    bookingPolicy: restaurant.booking_policy,
    logoUrl: restaurant.logo_url,
    emailSendReminder24h: restaurant.email_send_reminder_24h ?? true,
    emailSendReminderShort: restaurant.email_send_reminder_short ?? true,
    emailSendReviewRequest: restaurant.email_send_review_request ?? true,
    reservationIntervalMinutes: restaurant.reservation_interval_minutes,
    reservationDefaultDurationMinutes: restaurant.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: restaurant.reservation_last_seating_buffer_minutes,
    reservationLifecycleGraceMinutes:
      restaurant.reservation_lifecycle_grace_minutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    createdAt: restaurant.created_at,
    updatedAt: restaurant.updated_at,
  };
}
