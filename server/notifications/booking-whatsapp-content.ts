import { env } from '@/lib/env';
import { safeGoogleReviewUrl } from '@/lib/security/safe-url';
import { isBookingWhatsAppEventEligible } from '@/server/booking/whatsapp-consent';
import { createReviewShortUrl } from '@/server/bookings/short-link';
import {
  dispatchMobileNotification,
  type MobileDispatchResult,
} from '@/server/notifications/mobile';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';

type BookingWhatsAppActionContent = {
  readonly actionPath: string | null;
  readonly variables: Readonly<Record<string, string>>;
};

const BOOKING_SHORT_LINK_ORIGIN = 'https://go.nabatable.com';
const BOOKING_SHORT_LINK_PATH = /^\/m\/[A-Za-z0-9_-]+$/;
const REVIEW_SHORT_LINK_PATH = /^\/r\/[A-Za-z0-9_-]+$/;
const REVIEW_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class ReviewShortLinkInfrastructureError extends Error {
  constructor() {
    super('Review short-link infrastructure is unavailable.');
    this.name = 'ReviewShortLinkInfrastructureError';
  }
}

function resolveShortLinkActionPath(url: string, pathPattern: RegExp): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.origin === BOOKING_SHORT_LINK_ORIGIN &&
      parsed.username.length === 0 &&
      parsed.password.length === 0 &&
      parsed.search.length === 0 &&
      parsed.hash.length === 0 &&
      pathPattern.test(parsed.pathname)
    ) {
      return parsed.pathname.replace(/^\/+/, '');
    }
  } catch {
    return null;
  }
  return null;
}

export function buildBookingWhatsAppActionContent(params: {
  readonly venueName: string;
  readonly summaryLine: string;
  readonly referenceLine: string;
  readonly manageUrl: string;
}): BookingWhatsAppActionContent {
  const actionPath = resolveShortLinkActionPath(params.manageUrl, BOOKING_SHORT_LINK_PATH);

  return {
    actionPath,
    variables: {
      '1': params.venueName,
      '2': params.summaryLine,
      '3': params.referenceLine,
      '4': params.manageUrl,
      '5': actionPath ?? '',
    },
  };
}

export async function dispatchBookingReviewWhatsApp(
  booking: BookingRecord,
  restaurantId: string,
): Promise<MobileDispatchResult> {
  if (
    booking.status !== 'completed' ||
    booking.restaurant_id !== restaurantId ||
    !isBookingWhatsAppEventEligible({
      booking,
      event: 'post_visit_review',
      phone: booking.customer_phone,
    })
  ) {
    return { kind: 'ineligible' };
  }

  const client = getServiceSupabaseClient();
  const { data: venue, error } = await client
    .from('restaurants')
    .select('id, name, email_send_review_request, google_review_url')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    throw new Error('Failed to load venue review delivery settings.');
  }
  if (
    !venue ||
    venue.id !== restaurantId ||
    venue.email_send_review_request === false ||
    !venue.google_review_url ||
    !env.twilio.whatsapp.templates.reviewRequest
  ) {
    return { kind: 'ineligible' };
  }

  const destinationUrl = safeGoogleReviewUrl(venue.google_review_url);
  if (!destinationUrl) {
    return { kind: 'ineligible' };
  }

  const shortUrl = await createReviewShortUrl({
    bookingId: booking.id,
    restaurantId,
    destinationUrl,
    expiresAt: new Date(Date.now() + REVIEW_LINK_TTL_MS).toISOString(),
  });
  const actionPath = shortUrl ? resolveShortLinkActionPath(shortUrl, REVIEW_SHORT_LINK_PATH) : null;
  if (!actionPath) {
    throw new ReviewShortLinkInfrastructureError();
  }

  return dispatchMobileNotification(
    {
      bookingId: booking.id,
      logicalKey: `${booking.id}:booking_review_request`,
      notificationType: 'booking_review_request',
      recipientPhone: booking.customer_phone,
      restaurantId,
      whatsappEligible: true,
      whatsappTemplateId: env.twilio.whatsapp.templates.reviewRequest,
      whatsappVariables: {
        '1': venue.name,
        '2': actionPath,
      },
    },
    { sendSms: async () => null },
  );
}
