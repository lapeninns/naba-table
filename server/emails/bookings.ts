import { createHash } from 'node:crypto';

import config from '@/config';
import { env } from '@/lib/env';
import {
  buildCalendarEvent,
  type ReservationCalendarPayload,
} from '@/lib/reservations/calendar-event';
import {
  buildDeterministicVariantSeed,
  getEffectiveTemplateVariants,
  interpolateRestaurantEmailTemplateText,
  normalizeRestaurantEmailTemplatesDocument,
  pickDeterministicTemplateVariant,
  type BookingEmailTemplateVariableMap,
  type RestaurantBookingEmailTemplateKey,
  type RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';
import { type VenueDetails } from '@/lib/venue';
import {
  createEmailIdempotencyKey,
  sendEmail,
  type EmailAttachment,
  isEmailRecipientSuppressedError,
} from '@/libs/resend';
import {
  COLORS,
  renderButton,
  renderEmailBase,
  renderGridBox,
  renderNote,
  escapeHtml,
  EMAIL_FONT_STACK,
  type EmailAnnotation,
} from '@/server/emails/base';
import {
  hasRecentEmailDelivery,
  recordEmailDeliveryLog,
  type EmailDeliveryLogEntry,
} from '@/server/emails/email-delivery-log';
import {
  ensureLogoColumnOnRow,
  isLogoUrlColumnMissing,
  logLogoColumnFallback,
} from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  formatDateForInput,
  formatReservationDateShort,
  formatReservationTime,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';

import type { BookingRecord } from '@/server/bookings';
import type { Database } from '@/types/supabase';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

// Prefer the public site origin for guest-facing links; fall back to app URL if unset.
const bookingSiteUrl = (env.raw.NEXT_PUBLIC_SITE_URL ?? env.raw.SITE_URL ?? env.app.url).replace(
  /\/+$/,
  '',
);

function normalizeTimeLoose(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const normalized = normalizeTime(trimmed);
  if (normalized) return normalized;
  if (trimmed.length >= 5) {
    return normalizeTime(trimmed.slice(0, 5));
  }
  return null;
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveVenueDetails(restaurantId: string | null | undefined): Promise<VenueDetails> {
  if (!restaurantId) {
    throw new Error('[emails][bookings] restaurantId is required');
  }

  const supabase = getServiceSupabaseClient();
  const execute = (includeLogo: boolean) =>
    supabase
      .from('restaurants')
      .select(restaurantSelectColumns(includeLogo))
      .eq('id', restaurantId)
      .maybeSingle<RestaurantRow>();

  let { data, error } = await execute(true);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('resolveVenueDetails');
    ({ data, error } = await execute(false));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    console.error('[emails][bookings] venue lookup failed', {
      restaurantId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to fetch restaurant details: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  const restaurant = ensureLogoColumnOnRow(data);
  return {
    id: restaurant.id,
    slug: restaurant.slug || '',
    name: restaurant.name || 'Restaurant',
    timezone: restaurant.timezone || 'Europe/London',
    address: restaurant.address || '',
    phone: restaurant.contact_phone || '',
    email: restaurant.contact_email || '',
    policy: restaurant.booking_policy || '',
    logoUrl: restaurant.logo_url || null,
    googleMapUrl: restaurant.google_map_url || null,
    googleReviewUrl: restaurant.google_review_url || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- email_templates pending type regeneration
    emailTemplates: normalizeRestaurantEmailTemplatesDocument((restaurant as any).email_templates),
  };
}

function buildTemplateVariables(
  booking: BookingRecord,
  venue: VenueDetails,
  summary: BookingSummary,
): BookingEmailTemplateVariableMap {
  const guestFirstName = booking.customer_name.split(/\s+/)[0] || booking.customer_name;

  return {
    name: guestFirstName,
    firstName: guestFirstName,
    venue: venue.name,
    date: summary.date,
    time: summary.startTime,
    party: booking.party_size === 1 ? '1 Person' : `${booking.party_size} People`,
  };
}

function resolveTemplateKey(params: {
  type: BookingEmailType;
  booking: BookingRecord;
  reminderVariant?: 'short' | 'standard';
}): RestaurantBookingEmailTemplateKey | null {
  const isPending = params.booking.status === 'pending' || params.booking.status === 'pending_allocation';

  switch (params.type) {
    case 'created':
      return isPending ? 'request_received' : 'confirmation';
    case 'updated':
    case 'modification_confirmed':
      return 'modification_confirmed';
    case 'cancelled':
      return 'cancelled';
    case 'modification_pending':
      return 'modification_pending';
    case 'booking_rejected':
      return 'booking_rejected';
    case 'restaurant_cancellation':
      return 'restaurant_cancellation';
    case 'review_request':
      return 'review_request';
    case 'reminder':
      return params.reminderVariant === 'short' ? 'reminder_short' : 'reminder_24h';
    case 'pending_attention':
      return null;
    default:
      return null;
  }
}

function resolveTemplateVariant(params: {
  booking: BookingRecord;
  venue: VenueDetails;
  summary: BookingSummary;
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail: string;
  draftVariants?: RestaurantEmailTemplateVariant[];
  preferredVariantId?: string;
}): {
  templateVariant: RestaurantEmailTemplateVariant;
  headline: string;
  intro: string;
  ctaLabel: string;
  source: 'default' | 'custom' | 'draft';
} {
  const variables = buildTemplateVariables(params.booking, params.venue, params.summary);
  const effectiveTemplate = params.draftVariants?.length
    ? { variants: params.draftVariants, source: 'draft' as const }
    : getEffectiveTemplateVariants(params.templateKey, params.venue.emailTemplates);
  const preferredVariant =
    params.preferredVariantId
      ? effectiveTemplate.variants.find((variant) => variant.id === params.preferredVariantId)
      : null;
  const templateVariant =
    preferredVariant ??
    pickDeterministicTemplateVariant(
      effectiveTemplate.variants,
      buildDeterministicVariantSeed({
        bookingId: params.booking.id,
        templateKey: params.templateKey,
        recipientEmail: params.recipientEmail,
      }),
    );

  return {
    templateVariant,
    headline: interpolateRestaurantEmailTemplateText(templateVariant.headline, variables),
    intro: interpolateRestaurantEmailTemplateText(templateVariant.intro, variables),
    ctaLabel: interpolateRestaurantEmailTemplateText(templateVariant.ctaLabel, variables),
    source: effectiveTemplate.source,
  };
}

function buildManageUrl(booking: BookingRecord) {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  const ttlSeconds = env.security.sessionRecoveryAccessTokenTtlSeconds;
  const restaurantId = booking.restaurant_id;
  const email = booking.customer_email;
  const phone = booking.customer_phone;

  const buildRecoverErrorUrl = (code: string) => {
    const errorUrl = new URL(`${bookingSiteUrl}/bookings/recover/error`);
    errorUrl.searchParams.set('code', code);
    return errorUrl.toString();
  };

  if (!secret) {
    return buildRecoverErrorUrl('ACCESS_TOKEN_NOT_CONFIGURED');
  }

  if (!restaurantId || !email || !phone) {
    return buildRecoverErrorUrl('MISSING_ACCESS_TOKEN');
  }

  try {
    const accessToken = createSessionRecoveryAccessToken({
      restaurantId,
      email,
      phone,
      secret,
      ttlSeconds,
    });

    const recoverUrl = new URL(`${bookingSiteUrl}/bookings/recover`);
    recoverUrl.searchParams.set('access_token', accessToken);
    recoverUrl.searchParams.set('next', `/bookings/${booking.id}`);
    return recoverUrl.toString();
  } catch {
    return buildRecoverErrorUrl('INVALID_ACCESS_TOKEN');
  }
}

function buildCalendarPayload(
  booking: BookingRecord,
  venue: VenueDetails,
): ReservationCalendarPayload {
  const startAt = parseTimestamp(booking.start_at);
  const endAt = parseTimestamp(booking.end_at);

  return {
    reservationId: booking.id,
    reference: booking.reference,
    guestName: booking.customer_name,
    guestEmail: booking.customer_email,
    partySize: booking.party_size,
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    venueName: venue.name,
    venueAddress: venue.address,
    venueTimezone: venue.timezone,
    venueEmail: venue.email,
    status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
  };
}



type BookingSummary = {
  date: string;
  startTime: string;
  endTime: string;
  party: string;
};

function buildSummary(booking: BookingRecord, venue: VenueDetails): BookingSummary {
  const startAt = parseTimestamp(booking.start_at);
  const endAt = parseTimestamp(booking.end_at);
  const { timezone } = venue;

  const date = startAt
    ? formatReservationDateShort(formatDateForInput(startAt), { timezone })
    : formatReservationDateShort(booking.booking_date, { timezone });

  const startTime = startAt
    ? formatReservationTimeFromDate(startAt, { timezone })
    : formatReservationTime(normalizeTimeLoose(booking.start_time), { timezone });

  const endTime = endAt
    ? formatReservationTimeFromDate(endAt, { timezone })
    : formatReservationTime(normalizeTimeLoose(booking.end_time), { timezone });
  const party = `${booking.party_size} ${booking.party_size === 1 ? 'Person' : 'People'}`;

  return { date, startTime, endTime, party };
}

function buildBookingEmailIdempotencyKey(params: {
  booking: BookingRecord;
  templateType: string;
  recipientEmail: string;
}) {
  const digest = createHash('sha256')
    .update(
      [
        params.booking.id,
        params.templateType,
        params.recipientEmail,
        params.booking.updated_at ?? '',
        params.booking.start_at ?? '',
        params.booking.status ?? '',
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 16);

  return createEmailIdempotencyKey({
    scope: 'booking-email',
    parts: [params.booking.id, params.templateType, digest],
  });
}


// --- Template Logic ---

type TemplateConfig = {
  color: string;
  bgColor: string;
  icon: string; // SVG string
};

const ICONS = {
  pending: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
  confirmed: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`,
  info: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`,
  arrival: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`,
  review: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>`,
  cancel: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
  error: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
}

function getDescription(
  type: string,
  isPending: boolean,
  status: BookingRecord['status'],
  reminderVariant?: 'short' | 'standard'
): TemplateConfig {

  // Logic to determine visual style
  if (type === 'reminder') {
    return reminderVariant === 'short'
      ? { color: COLORS.arrival, bgColor: COLORS.arrivalBg, icon: ICONS.arrival }
      : { color: COLORS.info, bgColor: COLORS.infoBg, icon: ICONS.info };
  }

  if (type === 'review_request') {
    return { color: COLORS.review, bgColor: COLORS.reviewBg, icon: ICONS.review };
  }

  if (type === 'restaurant_cancellation' || type === 'booking_rejected') {
    return { color: COLORS.error, bgColor: COLORS.errorBg, icon: ICONS.error };
  }

  if (status === 'cancelled' || status === 'no_show') {
    return { color: COLORS.cancel, bgColor: COLORS.cancelBg, icon: ICONS.cancel };
  }

  if (isPending || status === 'pending_allocation') {
    return { color: COLORS.pending, bgColor: COLORS.pendingBg, icon: ICONS.pending };
  }

  return { color: COLORS.success, bgColor: COLORS.successBg, icon: ICONS.confirmed };
}


export function renderHtml({
  booking,
  venue,
  summary,
  headline,
  intro,
  ctaLabel,
  ctaUrl,
  iconOverwrite,
  colorOverwrite,
  emailType
}: {
  booking: BookingRecord;
  venue: VenueDetails;
  summary: BookingSummary;
  headline: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
  calendarActionUrl?: string;
  walletActionUrl?: string;
  calendarAttachmentName?: string;
  iconOverwrite?: string;
  colorOverwrite?: string;
  emailType?: string;
}) {
  const isPending = booking.status === 'pending' || booking.status === 'pending_allocation';
  const templateConfig = getDescription(emailType || 'created', isPending, booking.status);

  const ui = {
    color: colorOverwrite || templateConfig.color,
    bg: templateConfig.bgColor,
    icon: iconOverwrite || templateConfig.icon
  };

  const manageUrl = buildManageUrl(booking);

  // Schema.org Annotation
  const annotation: EmailAnnotation = {
    actionName: ctaLabel,
    actionUrl: ctaUrl || manageUrl,
    reservation: {
      confirmationNumber: booking.reference || booking.id,
      status: booking.status === 'cancelled' ? 'ReservationCancelled' : (isPending ? 'ReservationPending' : 'ReservationConfirmed'),
      startTime: parseTimestamp(booking.start_at)?.toISOString() || new Date().toISOString(),
      partySize: booking.party_size,
      venue: {
        name: venue.name,
        address: venue.address
      }
    }
  };

  // Build table-based content HTML for email client compatibility
  const contentHtml = `
    <!-- Status Bar -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="height:6px;background-color:${ui.color};font-size:6px;line-height:6px;">&nbsp;</td>
      </tr>
    </table>
    
    <!-- Main Content -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" class="mobile-padding" style="padding:40px 40px 32px;">
          
          <!-- Logo -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${bookingSiteUrl}" style="font-size:18px;font-weight:700;color:${COLORS.brand};text-decoration:none;letter-spacing:-0.02em;font-family:${EMAIL_FONT_STACK};">
                  ${escapeHtml(venue.name)}
                </a>
              </td>
            </tr>
          </table>

          <!-- Hero Icon -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" valign="middle" style="width:72px;height:72px;border-radius:50%;background-color:${ui.bg};">
                      <div style="width:32px;height:32px;color:${ui.color};">
                        ${ui.icon}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Title -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding-bottom:16px;">
                <h1 style="margin:0;color:${COLORS.brand};font-size:24px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;font-family:${EMAIL_FONT_STACK};">${escapeHtml(headline)}</h1>
              </td>
            </tr>
          </table>

          <!-- Intro Text -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding-bottom:32px;">
                <p style="margin:0;color:${COLORS.text};font-size:16px;line-height:1.6;font-family:${EMAIL_FONT_STACK};">${escapeHtml(intro)}</p>
              </td>
            </tr>
          </table>

          <!-- Data Grid -->
          ${renderGridBox([
    { label: 'Date', value: summary.date },
    { label: 'Time', value: summary.startTime },
    { label: 'Guests', value: summary.party },
    { label: 'Reference', value: booking.reference ?? 'N/A' }
  ])}

          <!-- Notes -->
          ${booking.notes ? renderNote('📝', booking.notes) : ''}

          <!-- CTA Button -->
          ${ctaLabel && ctaUrl ? `
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding-bottom:8px;">
                ${renderButton(ctaLabel, ctaUrl)}
              </td>
            </tr>
          </table>
          ` : ''}

          <!-- Venue Info -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding-top:24px;">
                <p style="margin:0;font-size:14px;color:${COLORS.muted};font-family:${EMAIL_FONT_STACK};">${escapeHtml(venue.address)}</p>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  `;

  return renderEmailBase({
    title: headline,
    preheader: intro,
    contentHtml,
    annotation,
    manageUrl,
    helpUrl: `${bookingSiteUrl}/help`
  });
}

function renderText(
  booking: BookingRecord,
  venue: VenueDetails,
  summary: BookingSummary,
  headline: string,
  intro: string,
  manageUrl: string
) {
  return `
${headline.toUpperCase()}
${'-'.repeat(headline.length)}

${intro}

DETAILS:
Date: ${summary.date}
Time: ${summary.startTime}
Guests: ${summary.party}
Reference: ${booking.reference || booking.id}

VENUE:
${venue.name}
${venue.address}
${venue.phone}

Manage your booking: ${manageUrl}
  `.trim();
}

type BookingEmailType =
  | 'created'
  | 'updated'
  | 'cancelled'
  | 'modification_pending'
  | 'modification_confirmed'
  | 'booking_rejected'
  | 'restaurant_cancellation'
  | 'review_request'
  | 'reminder'
  | 'pending_attention';

async function dispatchEmail(
  type: BookingEmailType,
  booking: BookingRecord,
  options?: {
    reminderVariant?: 'short' | 'standard';
    reason?: string;
    skipRecentDeliveryCheck?: boolean;
  },
): Promise<EmailDeliveryLogEntry | null> {
  const venue = await resolveVenueDetails(booking.restaurant_id);
  const manageUrl = buildManageUrl(booking);
  const summary = buildSummary(booking, venue);
  const isPending = booking.status === 'pending' || booking.status === 'pending_allocation';
  const calendarPayload = buildCalendarPayload(booking, venue);
  const calendarEventContent = buildCalendarEvent(calendarPayload);
  const attachments: EmailAttachment[] = [];
  const skipRecentDeliveryCheck = options?.skipRecentDeliveryCheck === true;
  const resolvedTemplateKey = resolveTemplateKey({
    type,
    booking,
    reminderVariant: options?.reminderVariant,
  });
  const deliveryTemplateType = resolvedTemplateKey ?? type;
  const deliveryEmailType = type === 'reminder' ? 'reminder' : type;

  let calendarAttachmentName: string | undefined;
  if (
    calendarEventContent &&
    !isPending &&
    booking.status !== 'cancelled' &&
    booking.status !== 'no_show'
  ) {
    const venueSlug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'reservation';
    calendarAttachmentName = `${venueSlug}-${booking.reference ?? booking.id}.ics`;
    attachments.push({
      filename: calendarAttachmentName,
      content: calendarEventContent,
      type: 'text/calendar',
    });
  }
  // Restaurant-specific booking URL (for "Book Again" etc)
  const restaurantBookingUrl = venue.slug
    ? `${bookingSiteUrl}/restaurants/${venue.slug}/book`
    : bookingSiteUrl;

  // Initialize email content variables
  let headline = '';
  let intro = '';
  let ctaLabel = '';
  let ctaUrl = manageUrl;
  let toEmail = booking.customer_email;

  switch (type) {
    case 'created':
      break;

    case 'updated':  // Fallthrough - 'updated' uses same template as 'modification_confirmed'
    case 'cancelled':
      break;

    case 'modification_pending':
      break;

    case 'modification_confirmed':
      break;

    case 'booking_rejected':
      break;

    case 'restaurant_cancellation':
      break;

    case 'review_request':
      break;

    case 'reminder':
      break;

    case 'pending_attention':
      headline = 'Action Required';
      intro = `A booking at ${venue.name} requires immediate attention. Reason: ${options?.reason ?? 'Manual assignment needed'}.`;
      ctaLabel = 'Review Now';
      ctaUrl = `${bookingSiteUrl}/dashboard/bookings/${booking.id}`;
      toEmail = venue.email || config.email.supportEmail || '';
      break;
  }

  if (resolvedTemplateKey) {
    const resolvedTemplate = resolveTemplateVariant({
      booking,
      venue,
      summary,
      templateKey: resolvedTemplateKey,
      recipientEmail: toEmail,
    });
    headline = resolvedTemplate.headline;
    intro = resolvedTemplate.intro;
    ctaLabel = resolvedTemplate.ctaLabel;
    ctaUrl = resolveCtaUrlForTemplate({
      templateKey: resolvedTemplateKey,
      booking,
      venue,
      manageUrl,
      restaurantBookingUrl,
    });
  }

  const html = renderHtml({
    booking,
    venue,
    summary,
    headline,
    intro,
    ctaLabel,
    ctaUrl,
    calendarAttachmentName,
    emailType:
      resolvedTemplateKey === 'reminder_short'
        ? 'arrival'
        : type === 'reminder'
          ? 'reminder'
          : type,
  });

  const text = renderText(booking, venue, summary, headline, intro, manageUrl);

  if (!toEmail) {
    console.warn(
      `[emails][bookings] No recipient email found for type ${type} (booking ${booking.id})`,
    );
    return null;
  }

  if (!skipRecentDeliveryCheck && deliveryTemplateType === 'review_request') {
    const alreadySent = await hasRecentEmailDelivery({
      bookingId: booking.id,
      templateType: deliveryTemplateType,
      withinMs: 60 * 24 * 60 * 60 * 1000,
    });
    if (alreadySent) {
      console.warn('[emails][bookings] review_request already sent recently; skipping', {
        bookingId: booking.id,
      });
      return null;
    }
  }

  if (!skipRecentDeliveryCheck && (deliveryTemplateType === 'reminder_24h' || deliveryTemplateType === 'reminder_short')) {
    const withinMs =
      deliveryTemplateType === 'reminder_24h' ? 3 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    const alreadySent = await hasRecentEmailDelivery({
      bookingId: booking.id,
      templateType: deliveryTemplateType,
      withinMs,
    });
    if (alreadySent) {
      console.warn('[emails][bookings] reminder already sent recently; skipping', {
        bookingId: booking.id,
        templateType: deliveryTemplateType,
      });
      return null;
    }
  }

  const subject = `${headline} - ${venue.name}`;
  let result;

  try {
    result = await sendEmail({
      to: toEmail,
      subject,
      html,
      text,
      attachments,
      fromName: venue.name,
      tags: [
        { name: 'email_type', value: deliveryEmailType },
        { name: 'template_type', value: deliveryTemplateType },
        { name: 'restaurant_id', value: booking.restaurant_id },
      ],
      idempotencyKey: buildBookingEmailIdempotencyKey({
        booking,
        templateType: deliveryTemplateType,
        recipientEmail: toEmail,
      }),
    });
  } catch (error) {
    if (isEmailRecipientSuppressedError(error)) {
      console.warn('[emails][bookings] recipient suppressed; skipping send', {
        bookingId: booking.id,
        templateType: deliveryTemplateType,
      });
      return null;
    }

    throw error;
  }

  return recordEmailDeliveryLog({
    bookingId: booking.id,
    restaurantId: booking.restaurant_id,
    emailType: deliveryEmailType,
    templateType: deliveryTemplateType,
    recipientEmail: toEmail,
    messageId: result.messageId,
    status: 'sent',
    provider: result.provider,
    metadata: {
      subject,
    },
  });
}

function resolveCtaUrlForTemplate(params: {
  templateKey: RestaurantBookingEmailTemplateKey;
  booking: BookingRecord;
  venue: VenueDetails;
  manageUrl: string;
  restaurantBookingUrl: string;
}): string {
  switch (params.templateKey) {
    case 'cancelled':
    case 'booking_rejected':
    case 'restaurant_cancellation':
      return params.restaurantBookingUrl;
    case 'review_request':
      return params.venue.googleReviewUrl || params.venue.googleMapUrl || `${bookingSiteUrl}/reviews/${params.booking.id}`;
    case 'reminder_24h':
    case 'reminder_short':
      return params.venue.googleMapUrl || params.manageUrl;
    default:
      return params.manageUrl;
  }
}

function resolveRenderEmailType(templateKey: RestaurantBookingEmailTemplateKey): string {
  switch (templateKey) {
    case 'request_received':
    case 'confirmation':
      return 'created';
    case 'reminder_short':
      return 'arrival';
    case 'reminder_24h':
      return 'reminder';
    default:
      return templateKey;
  }
}

function buildPreviewBooking(params: {
  restaurantId: string;
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail: string;
}): BookingRecord {
  const startAt = new Date('2026-04-08T19:00:00.000Z');
  const endAt = new Date('2026-04-08T20:30:00.000Z');
  const status =
    params.templateKey === 'request_received'
      ? 'pending'
      : params.templateKey === 'cancelled'
        ? 'cancelled'
        : 'confirmed';

  return {
    id: `preview-${params.templateKey}`,
    restaurant_id: params.restaurantId,
    assigned_zone_id: null,
    assignment_state_version: 0,
    assignment_strategy: null,
    customer_id: 'preview-customer',
    booking_date: '2026-04-08',
    start_time: '19:00',
    end_time: '20:30',
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    reference: 'PREVIEW42',
    party_size: 4,
    booking_type: 'dining',
    seating_preference: 'indoor',
    status,
    customer_name: 'Alex Johnson',
    customer_email: params.recipientEmail,
    customer_phone: '+447700900123',
    notes: 'Window table if available.',
    marketing_opt_in: true,
    source: 'ops-preview',
    client_request_id: `preview-${params.templateKey}`,
    pending_ref: null,
    idempotency_key: null,
    details: null,
    loyalty_points_awarded: 0,
    created_at: startAt.toISOString(),
    updated_at: startAt.toISOString(),
    auth_user_id: null,
    auto_assign_idempotency_key: null,
    auto_assign_last_result: null,
    checked_in_at: null,
    checked_out_at: null,
    confirmation_token: null,
    confirmation_token_expires_at: null,
    confirmation_token_used_at: null,
  } as BookingRecord;
}

export type RestaurantBookingEmailPreviewResult = {
  templateKey: RestaurantBookingEmailTemplateKey;
  selectedVariantId: string;
  headline: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  subject: string;
  html: string;
  text: string;
  previewBooking: BookingRecord;
};

export function renderRestaurantBookingEmailPreview(params: {
  venue: VenueDetails;
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail?: string;
  draftVariants?: RestaurantEmailTemplateVariant[];
  preferredVariantId?: string;
}): RestaurantBookingEmailPreviewResult {
  const recipientEmail = params.recipientEmail?.trim() || 'preview@nabatable.local';
  const booking = buildPreviewBooking({
    restaurantId: params.venue.id,
    templateKey: params.templateKey,
    recipientEmail,
  });
  const summary = buildSummary(booking, params.venue);
  const manageUrl = buildManageUrl(booking);
  const restaurantBookingUrl = params.venue.slug
    ? `${bookingSiteUrl}/restaurants/${params.venue.slug}/book`
    : bookingSiteUrl;
  const resolvedTemplate = resolveTemplateVariant({
    booking,
    venue: params.venue,
    summary,
    templateKey: params.templateKey,
    recipientEmail,
    draftVariants: params.draftVariants,
    preferredVariantId: params.preferredVariantId,
  });
  const ctaUrl = resolveCtaUrlForTemplate({
    templateKey: params.templateKey,
    booking,
    venue: params.venue,
    manageUrl,
    restaurantBookingUrl,
  });
  const subject = `${resolvedTemplate.headline} - ${params.venue.name}`;
  const html = renderHtml({
    booking,
    venue: params.venue,
    summary,
    headline: resolvedTemplate.headline,
    intro: resolvedTemplate.intro,
    ctaLabel: resolvedTemplate.ctaLabel,
    ctaUrl,
    emailType: resolveRenderEmailType(params.templateKey),
  });
  const text = renderText(
    booking,
    params.venue,
    summary,
    resolvedTemplate.headline,
    resolvedTemplate.intro,
    manageUrl,
  );

  return {
    templateKey: params.templateKey,
    selectedVariantId: resolvedTemplate.templateVariant.id,
    headline: resolvedTemplate.headline,
    intro: resolvedTemplate.intro,
    ctaLabel: resolvedTemplate.ctaLabel,
    ctaUrl,
    subject,
    html,
    text,
    previewBooking: booking,
  };
}

export async function sendRestaurantBookingEmailTest(params: {
  venue: VenueDetails;
  templateKey: RestaurantBookingEmailTemplateKey;
  toEmail: string;
  draftVariants?: RestaurantEmailTemplateVariant[];
  preferredVariantId?: string;
}): Promise<{
  provider: 'resend' | 'mock';
  messageId: string;
  preview: RestaurantBookingEmailPreviewResult;
}> {
  const preview = renderRestaurantBookingEmailPreview({
    venue: params.venue,
    templateKey: params.templateKey,
    recipientEmail: params.toEmail,
    draftVariants: params.draftVariants,
    preferredVariantId: params.preferredVariantId,
  });

  const result = await sendEmail({
    to: params.toEmail,
    subject: `[Test] ${preview.subject}`,
    html: preview.html,
    text: preview.text,
    fromName: params.venue.name,
    tags: [
      { name: 'email_type', value: 'booking-template-test' },
      { name: 'template_type', value: params.templateKey },
      { name: 'restaurant_id', value: params.venue.id },
    ],
    idempotencyKey: buildBookingEmailIdempotencyKey({
      booking: preview.previewBooking,
      templateType: `${params.templateKey}:test-send`,
      recipientEmail: params.toEmail,
    }),
  });

  return {
    provider: result.provider,
    messageId: result.messageId,
    preview,
  };
}


async function resendBookingEmailByDeliveryType(
  booking: BookingRecord,
  emailType: string | null,
  templateType: string | null,
): Promise<EmailDeliveryLogEntry | null> {
  const normalizedEmailType = emailType?.trim() ?? null;
  const normalizedTemplateType = templateType?.trim() ?? null;

  if (normalizedTemplateType === 'reminder_short' || normalizedTemplateType === 'reminder_24h') {
    return dispatchEmail('reminder', booking, {
      reminderVariant: normalizedTemplateType === 'reminder_short' ? 'short' : 'standard',
      skipRecentDeliveryCheck: true,
    });
  }

  if (normalizedTemplateType === 'request_received') {
    const pendingBooking = { ...booking, status: 'pending' } as BookingRecord;
    return dispatchEmail('created', pendingBooking, { skipRecentDeliveryCheck: true });
  }

  if (normalizedTemplateType === 'confirmation') {
    return dispatchEmail('created', booking, { skipRecentDeliveryCheck: true });
  }

  switch (normalizedEmailType) {
    case 'created':
      return dispatchEmail('created', booking, { skipRecentDeliveryCheck: true });
    case 'updated':
    case 'modification_confirmed':
      return dispatchEmail('modification_confirmed', booking, { skipRecentDeliveryCheck: true });
    case 'cancelled':
      return dispatchEmail('cancelled', booking, { skipRecentDeliveryCheck: true });
    case 'modification_pending':
      return dispatchEmail('modification_pending', booking, { skipRecentDeliveryCheck: true });
    case 'booking_rejected':
      return dispatchEmail('booking_rejected', booking, { skipRecentDeliveryCheck: true });
    case 'restaurant_cancellation':
      return dispatchEmail('restaurant_cancellation', booking, { skipRecentDeliveryCheck: true });
    case 'review_request':
      return dispatchEmail('review_request', booking, { skipRecentDeliveryCheck: true });
    case 'reminder':
      return dispatchEmail('reminder', booking, {
        reminderVariant: normalizedTemplateType === 'reminder_short' ? 'short' : 'standard',
        skipRecentDeliveryCheck: true,
      });
    case 'pending_attention':
      return dispatchEmail('pending_attention', booking, {
        reason: 'Retry requested from delivery log',
        skipRecentDeliveryCheck: true,
      });
    default:
      if (normalizedTemplateType === 'review_request') {
        return dispatchEmail('review_request', booking, { skipRecentDeliveryCheck: true });
      }

      return dispatchEmail('created', booking, { skipRecentDeliveryCheck: true });
  }
}

export async function resendBookingEmailFromDeliveryLog(params: {
  booking: BookingRecord;
  emailType: string | null;
  templateType: string | null;
}): Promise<EmailDeliveryLogEntry | null> {
  return resendBookingEmailByDeliveryType(params.booking, params.emailType, params.templateType);
}
export const sendBookingConfirmationEmail = (booking: BookingRecord) =>
  dispatchEmail('created', booking);
export const sendBookingUpdateEmail = (booking: BookingRecord) =>
  dispatchEmail('modification_confirmed', booking);
export const sendBookingCancellationEmail = (booking: BookingRecord) =>
  dispatchEmail('cancelled', booking);
export const sendBookingModificationPendingEmail = (booking: BookingRecord) =>
  dispatchEmail('modification_pending', booking);
export const sendBookingModificationConfirmedEmail = (booking: BookingRecord) =>
  dispatchEmail('modification_confirmed', booking);
export const sendBookingRejectedEmail = (booking: BookingRecord) =>
  dispatchEmail('booking_rejected', booking);
export const sendRestaurantCancellationEmail = (booking: BookingRecord) =>
  dispatchEmail('restaurant_cancellation', booking);
export const sendBookingReviewRequestEmail = (booking: BookingRecord) =>
  dispatchEmail('review_request', booking);
export const sendBookingReminderEmail = (
  booking: BookingRecord,
  options: { variant: 'short' | 'standard' },
) => dispatchEmail('reminder', booking, { reminderVariant: options.variant });
export const sendBookingPendingAttentionEmail = (
  booking: BookingRecord,
  options: { reason: string },
) => dispatchEmail('pending_attention', booking, { reason: options.reason });
