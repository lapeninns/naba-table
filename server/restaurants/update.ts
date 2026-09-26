import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import { assertValidTimezone } from '@/server/restaurants/timezone';
import { getServiceSupabaseClient } from '@/server/supabase';

import {
  RestaurantUpdateError,
  fieldValidationError,
  slugTakenError,
} from './update-errors';

import type { Database, Json } from '@/types/supabase';
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
  managerWhatsappEnabled?: boolean;
  managerWhatsappConsentActorId?: string;
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
  /**
   * Nabatable-managed business description. `undefined` leaves it alone; it is written in the
   * same transaction as the restaurant row.
   */
  businessDescription?: string | null;
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
  businessDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

type WhatsappIntent = 'enable' | 'disable' | null;

/** Check constraints on `restaurants` → the request field they validate. */
const CHECK_CONSTRAINT_FIELDS: Record<string, { field: string; message: string }> = {
  restaurants_capacity_check: { field: 'capacity', message: 'Capacity must be greater than 0.' },
  restaurants_slug_check: {
    field: 'slug',
    message: 'Use lowercase letters, numbers and single hyphens.',
  },
  restaurants_manager_name_check: {
    field: 'managerName',
    message: 'Manager name must be 80 characters or fewer.',
  },
  restaurants_manager_notification_phone_check: {
    field: 'managerNotificationPhone',
    message: 'Use international format, for example +447700900123.',
  },
  restaurants_reservation_interval_minutes_check: {
    field: 'reservationIntervalMinutes',
    message: 'Reservation interval must be between 1 and 180 minutes.',
  },
  restaurants_reservation_default_duration_minutes_check: {
    field: 'reservationDefaultDurationMinutes',
    message: 'Reservation duration must be between 15 and 300 minutes.',
  },
  restaurants_reservation_last_seating_buffer_minutes_check: {
    field: 'reservationLastSeatingBufferMinutes',
    message: 'Last seating buffer must be between 15 and 300 minutes.',
  },
};

const MANAGER_PHONE_REQUIRED_MESSAGE = 'Add a manager alert number before turning on WhatsApp.';

function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  field: string,
  message: string,
): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw fieldValidationError(field, message);
  }
  return value;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Builds the snake_case column patch. Consent columns are derived by the database. */
function buildRestaurantPatch(input: UpdateRestaurantInput): RestaurantUpdate {
  const patch: RestaurantUpdate = {};

  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (input.timezone !== undefined) {
    try {
      patch.timezone = assertValidTimezone(input.timezone);
    } catch {
      throw fieldValidationError('timezone', 'Choose a valid timezone.');
    }
  }

  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail;
  if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone;
  if (input.address !== undefined) patch.address = input.address;

  if (input.managerNotificationPhone !== undefined) {
    patch.manager_notification_phone = trimmedOrNull(input.managerNotificationPhone);
  }
  if (input.managerName !== undefined) patch.manager_name = trimmedOrNull(input.managerName);
  if (input.managerDailySummaryEnabled !== undefined) {
    patch.manager_daily_summary_enabled = input.managerDailySummaryEnabled;
  }

  if (input.googleMapUrl !== undefined) {
    patch.google_map_url = safeGoogleMapsUrl(input.googleMapUrl);
  }
  if (input.googleReviewUrl !== undefined) {
    patch.google_review_url = safeGoogleReviewUrl(input.googleReviewUrl);
  }
  if (input.bookingPolicy !== undefined) patch.booking_policy = input.bookingPolicy;
  if (input.logoUrl !== undefined) patch.logo_url = trimmedOrNull(input.logoUrl);

  if (input.reservationIntervalMinutes !== undefined) {
    patch.reservation_interval_minutes = assertIntegerInRange(
      input.reservationIntervalMinutes,
      1,
      180,
      'reservationIntervalMinutes',
      'Reservation interval must be an integer between 1 and 180 minutes.',
    );
  }
  if (input.reservationDefaultDurationMinutes !== undefined) {
    patch.reservation_default_duration_minutes = assertIntegerInRange(
      input.reservationDefaultDurationMinutes,
      15,
      300,
      'reservationDefaultDurationMinutes',
      'Reservation duration must be an integer between 15 and 300 minutes.',
    );
  }
  if (input.reservationLastSeatingBufferMinutes !== undefined) {
    patch.reservation_last_seating_buffer_minutes = assertIntegerInRange(
      input.reservationLastSeatingBufferMinutes,
      15,
      300,
      'reservationLastSeatingBufferMinutes',
      'Last seating buffer must be an integer between 15 and 300 minutes.',
    );
  }
  if (input.reservationLifecycleGraceMinutes !== undefined) {
    patch.reservation_lifecycle_grace_minutes = assertIntegerInRange(
      input.reservationLifecycleGraceMinutes,
      0,
      120,
      'reservationLifecycleGraceMinutes',
      'Lifecycle grace period must be an integer between 0 and 120 minutes.',
    );
  }

  if (input.emailSendReminder24h !== undefined) {
    patch.email_send_reminder_24h = input.emailSendReminder24h;
  }
  if (input.emailSendReminderShort !== undefined) {
    patch.email_send_reminder_short = input.emailSendReminderShort;
  }
  if (input.emailSendReviewRequest !== undefined) {
    patch.email_send_review_request = input.emailSendReviewRequest;
  }

  return patch;
}

function whatsappIntent(input: UpdateRestaurantInput): WhatsappIntent {
  if (input.managerWhatsappEnabled === true) return 'enable';
  if (input.managerWhatsappEnabled === false) return 'disable';
  return null;
}

type RpcError = { code?: string; message?: string };

function constraintNameFrom(message: string | undefined): string | null {
  const match = /constraint "([a-z0-9_]+)"/i.exec(message ?? '');
  return match?.[1] ?? null;
}

/**
 * Maps known database refusals to user-presentable errors. Anything else becomes an Error that
 * names only the SQLSTATE, so no database text (or data inside it) reaches logs or clients.
 */
function mapRpcError(error: RpcError): Error {
  const constraint = constraintNameFrom(error.message);

  if (error.code === '23505') {
    if (!constraint || constraint.includes('slug')) {
      return slugTakenError();
    }
  }

  if (error.code === '23514' && constraint) {
    const mapped = CHECK_CONSTRAINT_FIELDS[constraint];
    if (mapped) {
      return fieldValidationError(mapped.field, mapped.message);
    }
  }

  if (error.code === '22023') {
    if (error.message === 'MANAGER_PHONE_REQUIRED') {
      return fieldValidationError('managerNotificationPhone', MANAGER_PHONE_REQUIRED_MESSAGE);
    }
    if (error.message === 'CONSENT_ACTOR_REQUIRED') {
      return fieldValidationError(
        'managerWhatsappEnabled',
        'Sign in again to record WhatsApp consent.',
      );
    }
  }

  if (error.code === 'P0002') {
    return new RestaurantUpdateError('RESTAURANT_NOT_FOUND', 'Restaurant not found.');
  }

  const failure = new Error(`Restaurant update failed (${error.code ?? 'unknown'})`);
  failure.name = 'RestaurantUpdateFailure';
  return failure;
}

type ProfileRpcResult = {
  restaurant: RestaurantRow;
  business_description: string | null;
  previous: { name: string; slug: string; logo_url: string | null };
};

function isProfileRpcResult(value: unknown): value is ProfileRpcResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    restaurant?: unknown;
    business_description?: unknown;
    previous?: unknown;
  };
  const restaurant = candidate.restaurant as { id?: unknown } | null | undefined;
  const previous = candidate.previous as
    | { name?: unknown; slug?: unknown; logo_url?: unknown }
    | null
    | undefined;
  return (
    Boolean(restaurant) &&
    typeof restaurant?.id === 'string' &&
    (candidate.business_description === null ||
      typeof candidate.business_description === 'string') &&
    Boolean(previous) &&
    typeof previous?.name === 'string' &&
    typeof previous?.slug === 'string' &&
    (previous?.logo_url === null || typeof previous?.logo_url === 'string')
  );
}

/** Values the update replaced, read under the same row lock as the write. */
export type RestaurantPreviousValues = {
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type RestaurantProfileUpdateResult = {
  restaurant: UpdatedRestaurant;
  previous: RestaurantPreviousValues;
};

async function assertSlugAvailable(
  client: DbClient,
  restaurantId: string,
  slug: string,
): Promise<void> {
  const { data, error } = await client
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .neq('id', restaurantId)
    .maybeSingle();

  if (error) {
    // The write below still enforces uniqueness (restaurants_slug_key); the pre-check only gives
    // an early, friendly answer.
    return;
  }

  if (data) {
    throw slugTakenError();
  }
}

/**
 * Updates the restaurant row, the WhatsApp consent derived from it and (optionally) the business
 * description in one transaction (`update_restaurant_profile_v1`). Known refusals throw
 * `RestaurantUpdateError`; anything else throws a generic Error with no database text.
 */
export async function updateRestaurant(
  restaurantId: string,
  input: UpdateRestaurantInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<UpdatedRestaurant> {
  const { restaurant } = await updateRestaurantProfile(restaurantId, input, client);
  return restaurant;
}

/**
 * `updateRestaurant`, plus the name, slug and logo the update replaced. Callers use these to act
 * only on real changes (membership cache refresh) and to delete exactly the replaced logo object.
 */
export async function updateRestaurantProfile(
  restaurantId: string,
  input: UpdateRestaurantInput,
  client: DbClient = getServiceSupabaseClient(),
): Promise<RestaurantProfileUpdateResult> {
  if (Object.keys(input).length === 0) {
    throw new Error('No fields to update');
  }

  const patch = buildRestaurantPatch(input);

  if (patch.slug !== undefined) {
    await assertSlugAvailable(client, restaurantId, patch.slug);
  }

  const setBusinessDescription = input.businessDescription !== undefined;
  const { data, error } = await client.rpc('update_restaurant_profile_v1', {
    p_restaurant_id: restaurantId,
    p_patch: patch as Json,
    p_whatsapp_intent: whatsappIntent(input),
    p_actor_id: input.managerWhatsappConsentActorId ?? null,
    p_set_business_description: setBusinessDescription,
    p_business_description: setBusinessDescription
      ? trimmedOrNull(input.businessDescription)
      : null,
  });

  if (error) {
    throw mapRpcError(error);
  }

  if (!isProfileRpcResult(data)) {
    throw new Error('Restaurant update returned an unexpected shape');
  }

  const row = data.restaurant;

  const restaurant: UpdatedRestaurant = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active ?? true,
    timezone: row.timezone,
    capacity: row.capacity,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    managerDailySummaryEnabled: row.manager_daily_summary_enabled ?? false,
    managerWhatsappEnabled: row.manager_whatsapp_enabled ?? false,
    managerName: row.manager_name,
    managerNotificationPhone: row.manager_notification_phone,
    googleMapUrl: safeGoogleMapsUrl(row.google_map_url),
    googleReviewUrl: safeGoogleReviewUrl(row.google_review_url),
    bookingPolicy: row.booking_policy,
    logoUrl: row.logo_url ?? null,
    emailSendReminder24h: row.email_send_reminder_24h ?? true,
    emailSendReminderShort: row.email_send_reminder_short ?? true,
    emailSendReviewRequest: row.email_send_review_request ?? true,
    reservationIntervalMinutes: row.reservation_interval_minutes,
    reservationDefaultDurationMinutes: row.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: row.reservation_last_seating_buffer_minutes,
    reservationLifecycleGraceMinutes:
      row.reservation_lifecycle_grace_minutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
    businessDescription: data.business_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    restaurant,
    previous: {
      name: data.previous.name,
      slug: data.previous.slug,
      logoUrl: data.previous.logo_url,
    },
  };
}
