import { env } from '@/lib/env';
import { safeGoogleReviewUrl } from '@/lib/security/safe-url';
import { buildBookingManageUrl } from '@/server/bookings/manage-url';

type ShortLinkBooking = {
  id: string;
  restaurant_id: string | null | undefined;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
};

type ShortLinkPurpose = 'booking_manage' | 'review';

type ShortLinkCreateSource =
  | 'guest_confirmation_sms'
  | 'guest_update_sms'
  | 'guest_review_whatsapp';

type CreateShortLinkRequest = {
  purpose: ShortLinkPurpose;
  destinationUrl: string;
  bookingId: string;
  restaurantId: string | null | undefined;
  expiresAt: string;
  createdBy: ShortLinkCreateSource;
};

function isShortLinksConfigured(): boolean {
  return Boolean(
    env.cloudflare.bookingShortLinksInternalUrl &&
    env.cloudflare.bookingShortLinksInternalToken &&
    env.cloudflare.bookingShortLinksBaseUrl,
  );
}

function isRecoverErrorUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/bookings/recover/error';
  } catch {
    return true;
  }
}

function buildShortLinkExpiry(): string {
  const ttlSeconds = env.security.sessionRecoveryAccessTokenTtlSeconds;
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function isValidShortLinkResponse(
  value: unknown,
  expectedBaseUrl: string,
  purpose: ShortLinkPurpose,
): value is { shortUrl: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const shortUrl = (value as { shortUrl?: unknown }).shortUrl;
  if (typeof shortUrl !== 'string' || shortUrl.trim().length === 0) {
    return false;
  }

  try {
    const parsedShortUrl = new URL(shortUrl);
    const parsedBaseUrl = new URL(expectedBaseUrl);
    const expectedPathPrefix = purpose === 'review' ? '/r/' : '/m/';
    return (
      parsedShortUrl.origin === parsedBaseUrl.origin &&
      parsedShortUrl.pathname.startsWith(expectedPathPrefix)
    );
  } catch {
    return false;
  }
}

async function requestBookingShortLink(
  payload: CreateShortLinkRequest,
  options?: { fetchImpl?: typeof fetch },
): Promise<string | null> {
  const internalUrl = env.cloudflare.bookingShortLinksInternalUrl;
  const internalToken = env.cloudflare.bookingShortLinksInternalToken;
  const baseUrl = env.cloudflare.bookingShortLinksBaseUrl;

  if (!internalUrl || !internalToken || !baseUrl) {
    return null;
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;

  try {
    response = await fetchImpl(`${internalUrl.replace(/\/+$/, '')}/internal/booking-links`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${internalToken}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    if (!isValidShortLinkResponse(body, baseUrl, payload.purpose)) {
      return null;
    }
    return body.shortUrl;
  } catch {
    return null;
  }
}

export async function createBookingManageShortUrl(
  booking: ShortLinkBooking,
  params: {
    createdBy: ShortLinkCreateSource;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const longUrl = buildBookingManageUrl(booking);

  if (!isShortLinksConfigured() || isRecoverErrorUrl(longUrl)) {
    return longUrl;
  }

  const shortUrl = await requestBookingShortLink(
    {
      purpose: 'booking_manage',
      destinationUrl: longUrl,
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
      expiresAt: buildShortLinkExpiry(),
      createdBy: params.createdBy,
    },
    {
      fetchImpl: params.fetchImpl,
    },
  );

  return shortUrl ?? longUrl;
}

export async function createReviewShortUrl(params: {
  bookingId: string;
  restaurantId: string;
  destinationUrl: string;
  expiresAt: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!isShortLinksConfigured()) {
    return null;
  }

  const destinationUrl = safeGoogleReviewUrl(params.destinationUrl);
  if (!destinationUrl) {
    return null;
  }

  return requestBookingShortLink(
    {
      purpose: 'review',
      destinationUrl,
      bookingId: params.bookingId,
      restaurantId: params.restaurantId,
      expiresAt: params.expiresAt,
      createdBy: 'guest_review_whatsapp',
    },
    { fetchImpl: params.fetchImpl },
  );
}
