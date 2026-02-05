import config from '@/config';
import { env } from '@/lib/env';
import {
  buildCalendarEvent,
  type ReservationCalendarPayload,
} from '@/lib/reservations/calendar-event';
import { type VenueDetails } from '@/lib/venue';
import { sendEmail, type EmailAttachment } from '@/libs/resend';
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
import { hasRecentEmailDelivery, recordEmailDeliveryLog } from '@/server/emails/email-delivery-log';
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
    emailTemplates: (restaurant as any).email_templates || null,
  };
}

function resolveTemplate(
  baseHeadline: string,
  baseIntro: string,
  ctx: {
    type: string;
    venue: VenueDetails;
    guestName: string;
    booking: BookingRecord;
    summary: BookingSummary;
  }
) {
  const custom = ctx.venue.emailTemplates?.[ctx.type];
  if (!custom) {
    return { headline: baseHeadline, intro: baseIntro };
  }

  const vars: Record<string, string> = {
    '{{name}}': ctx.guestName,
    '{{firstName}}': ctx.guestName,
    '{{venue}}': ctx.venue.name,
    '{{date}}': ctx.summary.date,
    '{{time}}': ctx.summary.startTime,
    '{{party}}': String(ctx.booking.party_size),
  };

  const traverse = (text: string) => {
    return text.replace(/\{\{([\w]+)\}\}/g, (_, key) => vars[key] || '');
  };

  return {
    headline: custom.headline ? traverse(custom.headline) : baseHeadline,
    intro: custom.intro ? traverse(custom.intro) : baseIntro,
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
  },
) {
  const venue = await resolveVenueDetails(booking.restaurant_id);
  const manageUrl = buildManageUrl(booking);
  const summary = buildSummary(booking, venue);
  const guestFirstName = booking.customer_name.split(/\s+/)[0] || booking.customer_name;
  const isPending = booking.status === 'pending' || booking.status === 'pending_allocation';
  const calendarPayload = buildCalendarPayload(booking, venue);
  const calendarEventContent = buildCalendarEvent(calendarPayload);
  const attachments: EmailAttachment[] = [];

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



  // Helper for rotating copy to prevent email fatigue
  // Use booking ID to ensuring consistent variant for the same booking (deterministic)
  const copyVariant = (booking.id.charCodeAt(0) + booking.id.charCodeAt(booking.id.length - 1)) % 3;

  // Restaurant-specific booking URL (for "Book Again" etc)
  const restaurantBookingUrl = venue.slug
    ? `${bookingSiteUrl}/restaurants/${venue.slug}/book`
    : bookingSiteUrl;

  // Initialize email content variables
  let baseHeadline = '';
  let baseIntro = '';
  let ctaLabel = 'Manage Booking';
  let ctaUrl = manageUrl;
  let toEmail = booking.customer_email;

  switch (type) {
    case 'created':
      if (isPending) {
        baseHeadline = 'Request Received 🤞';
        baseIntro = `We've received your request for ${venue.name}. Hang tight while we check availability!`;
        ctaLabel = 'Check Status';
      } else {
        // Rotating copy for Confirmations
        if (copyVariant === 0) {
          baseHeadline = 'Booking Confirmed 🎉';
          baseIntro = `Great news, ${guestFirstName}! Your table at ${venue.name} is secured. We've added this to your upcoming bookings.`;
        } else if (copyVariant === 1) {
          baseHeadline = 'You\'re In! 🥂';
          baseIntro = `${guestFirstName}, your reservation at ${venue.name} is confirmed. We can't wait to host you!`;
        } else {
          baseHeadline = 'Table Secured 🍽️';
          baseIntro = `All set, ${guestFirstName}. We've reserved a spot for you at ${venue.name}. See you soon!`;
        }
        ctaLabel = 'Manage Booking';
      }
      break;

    case 'updated':  // Fallthrough - 'updated' uses same template as 'modification_confirmed'

    case 'cancelled':
      baseHeadline = 'Booking Cancelled 😔';
      baseIntro = `As requested, we have cancelled your reservation at ${venue.name}. We hope to welcome you another time. 👋`;
      ctaLabel = 'Book Again';
      ctaUrl = restaurantBookingUrl;
      break;

    case 'modification_pending':
      baseHeadline = 'Change Requested 📝';
      baseIntro = `We're reviewing your requested changes at ${venue.name}. We'll get back to you and confirm shortly.`;
      ctaLabel = 'View Request';
      break;

    case 'modification_confirmed':
      baseHeadline = 'Changes Confirmed ✅';
      baseIntro = `Your updated reservation at ${venue.name} is all set! Here are the new details.`;
      ctaLabel = 'View Booking';
      break;

    case 'booking_rejected':
      baseHeadline = 'Unavailable 🚫';
      baseIntro = `We're sorry, ${venue.name} is fully booked for your requested time. Maybe try a different date or time? ⏰`;
      ctaLabel = 'Try Another Time';
      ctaUrl = restaurantBookingUrl;
      break;

    case 'restaurant_cancellation':
      baseHeadline = 'Booking Cancelled 😔';
      baseIntro = `We sincerely apologize. ${venue.name} had to cancel your reservation due to unforeseen circumstances.`;
      ctaLabel = 'Rebook Now';
      ctaUrl = restaurantBookingUrl;
      break;

    case 'review_request':
      // Rotating copy for Reviews
      if (copyVariant === 0) {
        baseHeadline = 'How was dinner? ⭐';
        baseIntro = `We hope you enjoyed ${venue.name}! Would you mind taking 10 seconds to rate your experience? ❤️`;
      } else if (copyVariant === 1) {
        baseHeadline = 'Rate your experience 📝';
        baseIntro = `Hi ${guestFirstName}, thanks for dining with us at ${venue.name}! How did we do?`;
      } else {
        baseHeadline = 'We\'d love your feedback 💬';
        baseIntro = `It was a pleasure hosting you at ${venue.name}. Would you share your thoughts with us?`;
      }
      ctaLabel = 'Leave a Review';
      // Prioritize dedicated review URL, then Google Maps, then fallback
      ctaUrl = venue.googleReviewUrl || venue.googleMapUrl || `${bookingSiteUrl}/reviews/${booking.id}`;
      break;

    case 'reminder':
      if (options?.reminderVariant === 'short') { // Same day / Arrival
        baseHeadline = 'Table Ready 🍽️';
        baseIntro = `We've prepped your table at ${venue.name}. Please head to the host stand when you arrive.`;
        ctaLabel = 'Get Directions';
        ctaUrl = venue.googleMapUrl || manageUrl;
      } else {
        // Rotating copy for 24h Reminders
        if (copyVariant === 0) {
          baseHeadline = 'Tomorrow\'s the day 🥂';
          baseIntro = `Just a quick reminder about your reservation at ${venue.name} tomorrow. We can't wait to host you!`;
        } else if (copyVariant === 1) {
          baseHeadline = 'Upcoming Reservation 📅';
          baseIntro = `Hi ${guestFirstName}, getting excited? Your table at ${venue.name} is ready for tomorrow.`;
        } else {
          baseHeadline = 'See you soon! 👋';
          baseIntro = `This is a quick confirmation that we're ready for your visit to ${venue.name} tomorrow.`;
        }
        ctaLabel = 'Get Directions';
        ctaUrl = venue.googleMapUrl || manageUrl;
      }
      break;

    case 'pending_attention':
      baseHeadline = 'Action Required';
      baseIntro = `A booking at ${venue.name} requires immediate attention. Reason: ${options?.reason ?? 'Manual assignment needed'}.`;
      ctaLabel = 'Review Now';
      ctaUrl = `${bookingSiteUrl}/dashboard/bookings/${booking.id}`;
      toEmail = venue.email || config.email.supportEmail || '';
      break;
  }

  // Apply custom template if exists
  const { headline, intro } = resolveTemplate(baseHeadline, baseIntro, {
    type: type === 'reminder' ? (options?.reminderVariant === 'short' ? 'reminder_short' : 'reminder') : type,
    venue,
    guestName: guestFirstName,
    booking,
    summary,
  });

  const html = renderHtml({
    booking,
    venue,
    summary,
    headline,
    intro,
    ctaLabel,
    ctaUrl,
    calendarAttachmentName,
    emailType: type === 'reminder' ? (options?.reminderVariant === 'short' ? 'arrival' : 'reminder') : type,
  });

  const text = renderText(booking, venue, summary, headline, intro, manageUrl);

  if (!toEmail) {
    console.warn(
      `[emails][bookings] No recipient email found for type ${type} (booking ${booking.id})`,
    );
    return;
  }

  if (type === 'review_request') {
    const alreadySent = await hasRecentEmailDelivery({
      bookingId: booking.id,
      templateType: type,
      withinMs: 60 * 24 * 60 * 60 * 1000,
    });
    if (alreadySent) {
      console.warn('[emails][bookings] review_request already sent recently; skipping', {
        bookingId: booking.id,
      });
      return;
    }
  }

  const result = await sendEmail({
    to: toEmail,
    subject: `${headline} - ${venue.name}`,
    html,
    text,
    attachments,
    fromName: venue.name,
  });

  await recordEmailDeliveryLog({
    bookingId: booking.id,
    restaurantId: booking.restaurant_id,
    emailType: type,
    templateType: type,
    recipientEmail: toEmail,
    messageId: result.messageId,
    status: 'sent',
    provider: result.provider,
    metadata: {
      subject: `${headline} - ${venue.name}`,
    },
  });
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
