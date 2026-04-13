import { env } from '@/lib/env';
import {
  mapTwilioMessageStatusToDeliveryStatus,
  sendTwilioSmsMessage,
} from '@/lib/twilio/sms';
import { buildBookingManageUrl } from '@/server/bookings/manage-url';
import { createBookingManageShortUrl } from '@/server/bookings/short-link';
import { normalizePhone } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import { recordSmsDeliveryLog } from '@/server/sms/delivery-log';
import { getServiceSupabaseClient } from '@/server/supabase';
import { formatReservationDateShort, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';

import type { BookingRecord } from '@/server/bookings';

type SmsVenue = {
  id: string;
  name: string;
  timezone: string;
  phone?: string;
};

type SmsResult = {
  messageSid: string | null;
  status: string | null;
};

type SmsDeliveryType =
  | 'booking_confirmation'
  | 'booking_update'
  | 'booking_cancellation'
  | 'restaurant_cancellation';

type BookingCancellationActor = 'customer' | 'staff' | 'system';

const SUPPRESS_SMS =
  process.env.LOAD_TEST_DISABLE_SMS === 'true' || process.env.SUPPRESS_SMS === 'true';

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveSmsVenue(restaurantId: string): Promise<SmsVenue> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id,name,timezone,contact_phone')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to resolve booking SMS venue for ${restaurantId}`);
  }

  return {
    id: data.id,
    name: data.name || 'Restaurant',
    timezone: data.timezone || 'Europe/London',
    phone: data.contact_phone || '',
  };
}

function buildBookingSummaryLine(params: {
  booking: BookingRecord;
  venue: SmsVenue;
}): string {
  const startAt = parseTimestamp(params.booking.start_at);
  const date = startAt
    ? formatReservationDateShort(startAt.toISOString().slice(0, 10), {
        timezone: params.venue.timezone,
      })
    : params.booking.booking_date;
  const time = startAt
    ? formatReservationTimeFromDate(startAt, { timezone: params.venue.timezone })
    : params.booking.start_time;
  const partyLabel =
    params.booking.party_size === 1
      ? '1 guest'
      : `${params.booking.party_size} guests`;

  return `${date} at ${time} | ${partyLabel}`;
}

function buildBookingReferenceLine(booking: BookingRecord): string {
  return `Reference: ${booking.reference ?? booking.id}`;
}

function buildVenueContactLine(venue: SmsVenue): string | null {
  if (!venue.phone || venue.phone.trim().length === 0) {
    return null;
  }

  return `Contact: ${venue.phone.trim()}`;
}

function formatGuestBookingEventSms(params: {
  venue: SmsVenue;
  headline: string;
  detailsLine: string;
  referenceLine: string;
  actionLine?: string | null;
  contactLine?: string | null;
}): string {
  return [
    params.venue.name,
    '',
    params.headline,
    params.detailsLine,
    params.referenceLine,
    '',
    params.actionLine ?? null,
    params.contactLine ?? null,
  ]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join('\n');
}

export function hasGuestConfirmationSmsConfig(): boolean {
  return env.twilio.configured && !SUPPRESS_SMS;
}

export function buildGuestBookingConfirmationSms(params: {
  booking: BookingRecord;
  venue: SmsVenue;
  manageUrl?: string;
}): string {
  const manageUrl = params.manageUrl ?? buildBookingManageUrl(params.booking);

  return formatGuestBookingEventSms({
    venue: params.venue,
    headline: 'Your booking is confirmed.',
    detailsLine: buildBookingSummaryLine(params),
    referenceLine: buildBookingReferenceLine(params.booking),
    actionLine: `Manage your booking: ${manageUrl}`,
  });
}

export function buildGuestBookingUpdateSms(params: {
  booking: BookingRecord;
  venue: SmsVenue;
  manageUrl?: string;
}): string {
  const manageUrl = params.manageUrl ?? buildBookingManageUrl(params.booking);

  return formatGuestBookingEventSms({
    venue: params.venue,
    headline: 'Your booking has been updated.',
    detailsLine: buildBookingSummaryLine(params),
    referenceLine: buildBookingReferenceLine(params.booking),
    actionLine: `Manage your booking: ${manageUrl}`,
  });
}

export function buildGuestBookingCancellationSms(params: {
  booking: BookingRecord;
  venue: SmsVenue;
  cancelledBy: BookingCancellationActor;
}): string {
  const lead =
    params.cancelledBy === 'customer'
      ? 'Your booking has been cancelled.'
      : 'Your booking has been cancelled by the restaurant.';

  const contactLine = buildVenueContactLine(params.venue);

  return formatGuestBookingEventSms({
    venue: params.venue,
    headline: lead,
    detailsLine: buildBookingSummaryLine(params),
    referenceLine: buildBookingReferenceLine(params.booking),
    contactLine,
  });
}

async function sendGuestBookingSms(params: {
  booking: BookingRecord;
  body: string;
  source: string;
  smsType: SmsDeliveryType;
  fetchImpl?: typeof fetch;
}): Promise<SmsResult | null> {
  if (!hasGuestConfirmationSmsConfig()) {
    return null;
  }

  const recipient = normalizePhone(params.booking.customer_phone);
  if (!recipient) {
    return null;
  }

  const statusCallback =
    env.twilio.authToken && env.app.url
      ? new URL('/api/webhook/twilio/sms-status', env.app.url).toString()
      : undefined;

  const result = await sendTwilioSmsMessage({
    accountSid: env.twilio.accountSid as string,
    apiKeySid: env.twilio.apiKeySid as string,
    apiKeySecret: env.twilio.apiKeySecret as string,
    messagingServiceSid: env.twilio.messagingServiceSid as string,
    shortenUrls: env.twilio.shortenUrls,
    statusCallback,
    to: recipient,
    body: params.body,
    fetchImpl: params.fetchImpl,
  });

  await recordObservabilityEvent({
    source: params.source,
    eventType: 'sent',
    bookingId: params.booking.id,
    restaurantId: params.booking.restaurant_id,
    context: {
      messageSid: result.messageSid,
      status: result.status,
      to: recipient,
    },
  });

  const deliveryStatus = mapTwilioMessageStatusToDeliveryStatus(result.status) ?? 'queued';
  if (result.messageSid) {
    await recordSmsDeliveryLog({
      bookingId: params.booking.id,
      restaurantId: params.booking.restaurant_id,
      smsType: params.smsType,
      recipientPhone: recipient,
      messageSid: result.messageSid,
      status: deliveryStatus,
      provider: 'twilio',
      metadata: {
        source: params.source,
        initialTwilioStatus: result.status,
      },
    });
  }

  return result;
}

export async function sendGuestBookingConfirmationSms(
  booking: BookingRecord,
  options?: { fetchImpl?: typeof fetch },
): Promise<SmsResult | null> {
  const venue = await resolveSmsVenue(booking.restaurant_id);
  const manageUrl = await createBookingManageShortUrl(booking, {
    createdBy: 'guest_confirmation_sms',
    fetchImpl: options?.fetchImpl,
  });
  return sendGuestBookingSms({
    booking,
    body: buildGuestBookingConfirmationSms({
      booking,
      venue,
      manageUrl,
    }),
    source: 'booking.confirmation_sms',
    smsType: 'booking_confirmation',
    fetchImpl: options?.fetchImpl,
  });
}

export async function sendGuestBookingUpdateSms(
  booking: BookingRecord,
  options?: { fetchImpl?: typeof fetch },
): Promise<SmsResult | null> {
  const venue = await resolveSmsVenue(booking.restaurant_id);
  const manageUrl = await createBookingManageShortUrl(booking, {
    createdBy: 'guest_update_sms',
    fetchImpl: options?.fetchImpl,
  });
  return sendGuestBookingSms({
    booking,
    body: buildGuestBookingUpdateSms({
      booking,
      venue,
      manageUrl,
    }),
    source: 'booking.update_sms',
    smsType: 'booking_update',
    fetchImpl: options?.fetchImpl,
  });
}

export async function sendGuestBookingCancellationSms(
  booking: BookingRecord,
  options?: {
    cancelledBy: BookingCancellationActor;
    fetchImpl?: typeof fetch;
  },
): Promise<SmsResult | null> {
  const venue = await resolveSmsVenue(booking.restaurant_id);
  return sendGuestBookingSms({
    booking,
    body: buildGuestBookingCancellationSms({
      booking,
      venue,
      cancelledBy: options?.cancelledBy ?? 'customer',
    }),
    source:
      options?.cancelledBy === 'customer'
        ? 'booking.cancellation_sms'
        : 'booking.restaurant_cancellation_sms',
    smsType:
      options?.cancelledBy === 'customer' ? 'booking_cancellation' : 'restaurant_cancellation',
    fetchImpl: options?.fetchImpl,
  });
}
