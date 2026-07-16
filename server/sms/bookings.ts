import { env } from '@/lib/env';
import { redactSmsRecipientPhone } from '@/lib/sms/phone-redaction';
import { mapTwilioMessageStatusToDeliveryStatus, sendTwilioSmsMessage } from '@/lib/twilio/sms';
import { isBookingWhatsAppEventEligible } from '@/server/booking/whatsapp-consent';
import { buildBookingManageUrl } from '@/server/bookings/manage-url';
import { createBookingManageShortUrl } from '@/server/bookings/short-link';
import { normalizePhone } from '@/server/customers';
import { buildBookingWhatsAppActionContent } from '@/server/notifications/booking-whatsapp-content';
import {
  completeClaimedSmsAttempt,
  dispatchMobileNotification,
  finalizeMobileSmsAttempt,
} from '@/server/notifications/mobile';
import { recordObservabilityEvent } from '@/server/observability';
import { recordSmsDeliveryLog } from '@/server/sms/delivery-log';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  formatReservationDateShort,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';

import type { BookingRecord } from '@/server/bookings';
import type { MobileDispatchResult } from '@/server/notifications/mobile';

type SmsVenue = {
  id: string;
  name: string;
  timezone: string;
  phone?: string;
};

export function requiresDirectSmsAfterPendingWhatsAppFailure(
  result: MobileDispatchResult,
): boolean {
  return (
    result.kind === 'attempt_finalization_pending' &&
    result.status === 'failed' &&
    result.providerMessageId === null
  );
}

type SmsResult = {
  messageSid: string | null;
  status: string | null;
};

export type SmsDeliveryType =
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

function buildBookingSummaryLine(params: { booking: BookingRecord; venue: SmsVenue }): string {
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
    params.booking.party_size === 1 ? '1 guest' : `${params.booking.party_size} guests`;

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

export function buildSmsStatusCallbackUrl(params: {
  appUrl: string;
  attemptId?: string;
  bookingId: string;
  restaurantId: string;
  smsType: SmsDeliveryType;
}): string {
  const url = new URL('/api/webhook/twilio/sms-status', params.appUrl);
  url.searchParams.set('bookingId', params.bookingId);
  url.searchParams.set('restaurantId', params.restaurantId);
  url.searchParams.set('smsType', params.smsType);
  if (params.attemptId) {
    url.searchParams.set('attempt', params.attemptId);
  }
  return url.toString();
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

async function sendGuestBookingSmsOnly(params: {
  attemptId?: string;
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
      ? buildSmsStatusCallbackUrl({
          appUrl: env.app.url,
          attemptId: params.attemptId,
          bookingId: params.booking.id,
          restaurantId: params.booking.restaurant_id,
          smsType: params.smsType,
        })
      : undefined;

  const { accountSid, apiKeySecret, apiKeySid, messagingServiceSid } = env.twilio;
  if (!accountSid || !apiKeySecret || !apiKeySid || !messagingServiceSid) {
    return null;
  }

  const result = await sendTwilioSmsMessage({
    accountSid,
    apiKeySid,
    apiKeySecret,
    messagingServiceSid,
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
      to: redactSmsRecipientPhone(recipient),
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

function resolveWhatsAppTemplateId(smsType: SmsDeliveryType): string | null {
  const whatsapp = env.twilio.whatsapp;
  if (!whatsapp) {
    return null;
  }
  const templates = whatsapp.templates;
  switch (smsType) {
    case 'booking_confirmation':
      return templates.bookingConfirmation ?? null;
    case 'booking_update':
      return templates.bookingUpdate ?? null;
    case 'booking_cancellation':
      return templates.bookingCancellation ?? null;
    case 'restaurant_cancellation':
      return templates.restaurantCancellation ?? null;
  }
}

async function sendGuestBookingMobileMessage(params: {
  booking: BookingRecord;
  body: string;
  source: string;
  smsType: SmsDeliveryType;
  whatsappVariables: Readonly<Record<string, string>>;
  whatsappActionAvailable: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SmsResult | null> {
  if (!hasGuestConfirmationSmsConfig()) {
    return null;
  }

  const recipient = normalizePhone(params.booking.customer_phone);
  if (!recipient) {
    return null;
  }

  if (!env.twilio.whatsapp) {
    return sendGuestBookingSmsOnly(params);
  }

  const whatsappEligible = Boolean(
    isBookingWhatsAppEventEligible({
      booking: params.booking,
      event: params.smsType,
      phone: recipient,
    }) &&
    env.twilio.whatsapp.configured &&
    env.twilio.authToken,
  );
  let smsResult: SmsResult | null = null;
  const eventVersion =
    params.smsType === 'booking_confirmation'
      ? 'confirmation'
      : (params.booking.updated_at ?? params.booking.status);
  const channel = await dispatchMobileNotification(
    {
      bookingId: params.booking.id,
      logicalKey: `${params.booking.id}:${params.smsType}:${eventVersion}`,
      notificationType: params.smsType,
      recipientPhone: recipient,
      restaurantId: params.booking.restaurant_id,
      whatsappEligible,
      whatsappTemplateId: params.whatsappActionAvailable
        ? resolveWhatsAppTemplateId(params.smsType)
        : null,
      whatsappVariables: params.whatsappVariables,
    },
    {
      fetchImpl: params.fetchImpl,
      sendSms: async (attemptId) => {
        smsResult = await sendGuestBookingSmsOnly({ ...params, attemptId });
        return smsResult;
      },
    },
  );

  if (channel.kind === 'whatsapp_accepted') {
    return { messageSid: null, status: 'whatsapp_accepted' };
  }
  if (channel.kind === 'attempt_finalization_pending') {
    if (requiresDirectSmsAfterPendingWhatsAppFailure(channel)) {
      return sendGuestBookingSmsOnly(params);
    }
    return { messageSid: null, status: 'whatsapp_accepted' };
  }
  if (channel.kind === 'duplicate') {
    return { messageSid: null, status: 'duplicate' };
  }
  return smsResult;
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
  const whatsappContent = buildBookingWhatsAppActionContent({
    venueName: venue.name,
    summaryLine: buildBookingSummaryLine({ booking, venue }),
    referenceLine: buildBookingReferenceLine(booking),
    manageUrl,
  });
  return sendGuestBookingMobileMessage({
    booking,
    body: buildGuestBookingConfirmationSms({
      booking,
      venue,
      manageUrl,
    }),
    source: 'booking.confirmation_sms',
    smsType: 'booking_confirmation',
    whatsappVariables: whatsappContent.variables,
    whatsappActionAvailable: whatsappContent.actionPath !== null,
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
  const whatsappContent = buildBookingWhatsAppActionContent({
    venueName: venue.name,
    summaryLine: buildBookingSummaryLine({ booking, venue }),
    referenceLine: buildBookingReferenceLine(booking),
    manageUrl,
  });
  return sendGuestBookingMobileMessage({
    booking,
    body: buildGuestBookingUpdateSms({
      booking,
      venue,
      manageUrl,
    }),
    source: 'booking.update_sms',
    smsType: 'booking_update',
    whatsappVariables: whatsappContent.variables,
    whatsappActionAvailable: whatsappContent.actionPath !== null,
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
  const cancelledBy = options?.cancelledBy ?? 'customer';
  return sendGuestBookingMobileMessage({
    booking,
    body: buildGuestBookingCancellationSms({
      booking,
      venue,
      cancelledBy,
    }),
    source:
      cancelledBy === 'customer'
        ? 'booking.cancellation_sms'
        : 'booking.restaurant_cancellation_sms',
    smsType: cancelledBy === 'customer' ? 'booking_cancellation' : 'restaurant_cancellation',
    whatsappVariables: {
      '1': venue.name,
      '2': buildBookingSummaryLine({ booking, venue }),
      '3': buildBookingReferenceLine(booking),
      '4': buildVenueContactLine(venue) ?? venue.name,
    },
    whatsappActionAvailable: true,
    fetchImpl: options?.fetchImpl,
  });
}

export async function sendClaimedBookingSmsFallback({
  attemptId,
  notificationId,
  fetchImpl,
}: {
  attemptId: string;
  notificationId: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const client = getServiceSupabaseClient();
  const { data: notification, error: notificationError } = await client
    .from('mobile_notifications')
    .select('booking_id,notification_type,restaurant_id')
    .eq('id', notificationId)
    .single();
  if (notificationError || !notification?.booking_id) {
    return false;
  }

  const { data: booking, error: bookingError } = await client
    .from('bookings')
    .select('*')
    .eq('id', notification.booking_id)
    .eq('restaurant_id', notification.restaurant_id)
    .single();
  if (bookingError || !booking) {
    return false;
  }

  const venue = await resolveSmsVenue(notification.restaurant_id);
  let body: string;
  let smsType: SmsDeliveryType;
  switch (notification.notification_type) {
    case 'booking_confirmation':
    case 'booking_update': {
      const manageUrl = await createBookingManageShortUrl(booking, {
        createdBy:
          notification.notification_type === 'booking_confirmation'
            ? 'guest_confirmation_sms'
            : 'guest_update_sms',
        fetchImpl,
      });
      smsType = notification.notification_type;
      body =
        notification.notification_type === 'booking_confirmation'
          ? buildGuestBookingConfirmationSms({ booking, venue, manageUrl })
          : buildGuestBookingUpdateSms({ booking, venue, manageUrl });
      break;
    }
    case 'booking_cancellation':
    case 'restaurant_cancellation':
      smsType = notification.notification_type;
      body = buildGuestBookingCancellationSms({
        booking,
        venue,
        cancelledBy:
          notification.notification_type === 'booking_cancellation' ? 'customer' : 'staff',
      });
      break;
    default:
      return false;
  }

  await completeClaimedSmsAttempt(attemptId, {
    sendSms: (claimedAttemptId) =>
      sendGuestBookingSmsOnly({
        attemptId: claimedAttemptId,
        booking,
        body,
        fetchImpl,
        smsType,
        source: 'booking.whatsapp_sms_fallback',
      }),
    updateAttempt: async ({
      attemptId: claimedAttemptId,
      errorCode,
      providerMessageId,
      status,
    }) => {
      await finalizeMobileSmsAttempt({
        attemptId: claimedAttemptId,
        errorCode: errorCode ?? null,
        providerMessageId: providerMessageId ?? null,
        status,
      });
    },
  });
  return true;
}
