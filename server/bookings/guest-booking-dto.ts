import type { BookingRecord } from '@/server/bookings';

export type GuestBookingSource = Partial<BookingRecord> & { id: string };
export type GuestBookingExposure = 'full' | 'contact_query';

function maskEmail(value: string | null | undefined): string {
  const normalized = value?.trim() ?? '';
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '';

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const localPrefix = local.slice(0, 1);
  const domainParts = domain.split('.');
  const domainPrefix = domainParts[0]?.slice(0, 1) ?? '';
  const suffix = domainParts.length > 1 ? `.${domainParts.at(-1)}` : '';

  return `${localPrefix}***@${domainPrefix}***${suffix}`;
}

function maskPhone(value: string | null | undefined): string {
  const normalized = value?.trim() ?? '';
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `***${digits.slice(-4)}`;
}

function maskName(value: string | null | undefined): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) return '';
  return `${normalized.slice(0, 1)}***`;
}

export function toGuestBookingDTO(
  booking: GuestBookingSource,
  options: { restaurantName?: string | null; exposure?: GuestBookingExposure } = {},
) {
  if (options.exposure === 'contact_query') {
    return {
      id: '',
      restaurant_id: '',
      booking_date: booking.booking_date ?? '',
      start_time: '',
      end_time: null,
      start_at: null,
      end_at: null,
      reference: null,
      party_size: booking.party_size ?? 0,
      booking_type: booking.booking_type ?? 'dinner',
      seating_preference: booking.seating_preference ?? null,
      status: booking.status ?? 'pending',
      customer_name: maskName(booking.customer_name),
      customer_email: maskEmail(booking.customer_email),
      customer_phone: maskPhone(booking.customer_phone),
      notes: null,
      created_at: null,
      updated_at: null,
      restaurants: {
        name: options.restaurantName ?? null,
        slug: null,
        timezone: null,
      },
    };
  }

  return {
    id: booking.id,
    restaurant_id: booking.restaurant_id ?? '',
    booking_date: booking.booking_date ?? '',
    start_time: booking.start_time ?? '',
    end_time: booking.end_time ?? null,
    start_at: booking.start_at ?? null,
    end_at: booking.end_at ?? null,
    reference: booking.reference ?? null,
    party_size: booking.party_size ?? 0,
    booking_type: booking.booking_type ?? 'dinner',
    seating_preference: booking.seating_preference ?? null,
    status: booking.status ?? 'pending',
    customer_name: booking.customer_name ?? '',
    customer_email: booking.customer_email ?? '',
    customer_phone: booking.customer_phone ?? '',
    notes: null,
    created_at: booking.created_at ?? null,
    updated_at: booking.updated_at ?? null,
    restaurants: {
      name: options.restaurantName ?? null,
      slug: null,
      timezone: null,
    },
  };
}

export type GuestAccessKind = { kind: 'token' } | { kind: 'session' };

type GuestAccessRestaurant = {
  name?: string | null;
  slug?: string | null;
  timezone?: string | null;
} | null;

/**
 * The single guest-facing booking DTO for GET/PUT/DELETE /api/bookings/[id].
 * - Token (capability cookie) access gets masked contact details (initial of
 *   the name, last four phone digits, no email): a link can be forwarded, so it
 *   must not reveal the full email or phone.
 * - Session (bound account) access gets the full contact details.
 * Neither ever carries `idempotency_key`, `client_request_id` or
 * `confirmation_token`: those can replay a create or open retired endpoints.
 */
export function toGuestAccessBookingDTO(
  booking: GuestBookingSource,
  access: GuestAccessKind,
  restaurant: GuestAccessRestaurant = null,
) {
  const masked = access.kind === 'token';
  return {
    id: booking.id,
    restaurant_id: booking.restaurant_id ?? '',
    booking_date: booking.booking_date ?? '',
    start_time: booking.start_time ?? '',
    end_time: booking.end_time ?? null,
    start_at: booking.start_at ?? null,
    end_at: booking.end_at ?? null,
    reference: booking.reference ?? null,
    party_size: booking.party_size ?? 0,
    booking_type: booking.booking_type ?? 'dinner',
    seating_preference: booking.seating_preference ?? null,
    status: booking.status ?? 'pending',
    customer_name: masked ? maskName(booking.customer_name) : (booking.customer_name ?? ''),
    // The reservation adapter validates the email shape, so a masked email is
    // sent as an empty string rather than a partial address.
    customer_email: masked ? '' : (booking.customer_email ?? ''),
    customer_phone: masked ? maskPhone(booking.customer_phone) : (booking.customer_phone ?? ''),
    notes: booking.notes ?? null,
    marketing_opt_in: masked ? false : (booking.marketing_opt_in ?? false),
    created_at: booking.created_at ?? null,
    updated_at: booking.updated_at ?? null,
    restaurants: {
      name: restaurant?.name ?? null,
      slug: restaurant?.slug ?? null,
      timezone: restaurant?.timezone ?? null,
    },
  };
}

export type GuestAccessBookingDTO = ReturnType<typeof toGuestAccessBookingDTO>;
