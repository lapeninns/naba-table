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
  renderBadge,
  renderButton,
  renderDivider,
  renderEmailBase,
  renderKeyValueGrid,
  renderQuickActions,
  escapeHtml,
  EMAIL_FONT_STACK,
  type QuickAction,
  type KeyValueItem,
} from '@/server/emails/base';
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

function titleize(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatBookingTypeLabel(value: string | null | undefined) {
  return titleize(value) || 'Dining';
}

function formatSeatingLabel(value: string | null | undefined) {
  if (!value || value === 'any') return 'Any available';
  return titleize(value);
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
    name: restaurant.name || 'Restaurant',
    timezone: restaurant.timezone || 'Europe/London',
    address: restaurant.address || '',
    phone: restaurant.contact_phone || '',
    email: restaurant.contact_email || '',
    policy: restaurant.booking_policy || '',
    logoUrl: restaurant.logo_url || null,
    googleMapUrl: restaurant.google_map_url || null,
  };
}

type StatusPresentation = {
  label: string;
  badgeBg: string;
  badgeText: string;
  note: string;
};

const STATUS_PRESENTATION: Record<BookingRecord['status'], StatusPresentation> = {
  confirmed: {
    label: 'Confirmed',
    badgeBg: COLORS.success.bg,
    badgeText: COLORS.success.text,
    note: 'Show this ticket on arrival and we will take care of the rest.',
  },
  pending: {
    label: 'Awaiting confirmation',
    badgeBg: '#fef9c3', // Yellow 100
    badgeText: '#854d0e', // Yellow 800
    note: 'We will follow up as soon as the restaurant confirms your table.',
  },
  pending_allocation: {
    label: 'Allocation in progress',
    badgeBg: '#fef9c3',
    badgeText: '#854d0e',
    note: "You're on the list and we are securing the best table for your party.",
  },
  checked_in: {
    label: 'Checked in',
    badgeBg: COLORS.success.bg,
    badgeText: COLORS.success.text,
    note: 'Thanks for arriving on time. We hope you enjoy your experience.',
  },
  cancelled: {
    label: 'Cancelled',
    badgeBg: '#fee2e2', // Red 100
    badgeText: '#b91c1c', // Red 700
    note: 'Keep this for your records. Let us know if you need to book again.',
  },
  completed: {
    label: 'Completed',
    badgeBg: '#dbeafe', // Blue 100
    badgeText: '#1d4ed8', // Blue 700
    note: 'Thanks for dining with us. We hope to welcome you back soon.',
  },
  no_show: {
    label: 'No show',
    badgeBg: '#fee2e2',
    badgeText: '#b91c1c',
    note: "We missed you this time. Reach out if you'd like to rebook.",
  },
  PRIORITY_WAITLIST: {
    label: 'Priority Waitlist',
    badgeBg: '#f3e8ff', // Purple 100
    badgeText: '#6b21a8', // Purple 700
    note: 'You are on the priority waitlist. We will notify you as soon as a table becomes available.',
  },
};

function getStatusPresentation(status: BookingRecord['status'] | string): StatusPresentation {
  return (
    STATUS_PRESENTATION[(status as BookingRecord['status']) ?? 'confirmed'] ??
    STATUS_PRESENTATION.confirmed
  );
}

function buildManageUrl(booking: BookingRecord) {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  const ttlSeconds = env.security.sessionRecoveryAccessTokenTtlSeconds;
  const restaurantId = booking.restaurant_id;
  const email = booking.customer_email;
  const phone = booking.customer_phone;

  if (secret && restaurantId && email && phone) {
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
      // Non-fatal: fall back to legacy link formats
    }
  }

  let url = `${bookingSiteUrl}/bookings/${booking.id}`;
  if (booking.confirmation_token) {
    url += `?token=${booking.confirmation_token}`;
  }
  return url;
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

function buildGoogleCalendarUrl(booking: BookingRecord, venue: VenueDetails): string {
  const startAt = parseTimestamp(booking.start_at);
  const endAt = parseTimestamp(booking.end_at);

  if (!startAt || !endAt) return '';

  const formatGCalDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reservation at ${venue.name}`,
    dates: `${formatGCalDate(startAt)}/${formatGCalDate(endAt)}`,
    details: `Reservation for ${booking.party_size} people.\nReference: ${booking.reference}\n\nManage booking: ${buildManageUrl(booking)}`,
    location: venue.address,
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
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
  const party = `${booking.party_size} ${booking.party_size === 1 ? 'guest' : 'guests'}`;

  return { date, startTime, endTime, party };
}

function renderBrandHeader(venue: VenueDetails) {
  const safeName = escapeHtml(venue.name);
  if (venue.logoUrl) {
    const safeLogo = escapeHtml(venue.logoUrl);
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <img src="${safeLogo}" alt="${safeName} logo" width="80" style="max-width:80px;height:auto;border-radius:16px;" />
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:600;color:${COLORS.text.main};">${safeName}</td>
      </tr>
    </table>`;
  }

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding-bottom:12px;">
        <span style="display:inline-block;padding:8px 16px;border-radius:999px;background:${COLORS.background};color:${COLORS.primary};font-family:${EMAIL_FONT_STACK};font-weight:600;font-size:14px;">${safeName}</span>
      </td>
    </tr>
  </table>`;
}

export function renderHtml({
  booking,
  venue,
  summary,
  headline,
  intro,
  ctaLabel,
  ctaUrl,
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
}) {
  const manageUrl = buildManageUrl(booking);
  const statusPresentation = getStatusPresentation(booking.status);
  const bookingTypeLabel = formatBookingTypeLabel(booking.booking_type);
  const seatingLabel = formatSeatingLabel(booking.seating_preference);
  const timeRange = summary.endTime
    ? `${summary.startTime} – ${summary.endTime}`
    : summary.startTime;
  const notes = booking.notes?.trim();
  const preheader = `${summary.date} at ${summary.startTime} · ${venue.name}`;

  // Quick Actions
  const quickActions: QuickAction[] = [];

  // 1. Add to Calendar (Google)
  const googleCalendarUrl = buildGoogleCalendarUrl(booking, venue);
  if (googleCalendarUrl && booking.status !== 'cancelled' && booking.status !== 'no_show') {
    quickActions.push({
      label: 'Calendar',
      href: googleCalendarUrl,
      icon: '📅',
    });
  }

  // 2. Directions
  if (venue.googleMapUrl) {
    quickActions.push({
      label: 'Directions',
      href: venue.googleMapUrl,
      icon: '📍',
    });
  }

  // 3. Manage
  quickActions.push({
    label: 'Manage',
    href: manageUrl,
    icon: '⚙️',
  });

  // Key Value Grid
  const gridItems: KeyValueItem[] = [
    { label: 'Date', value: summary.date },
    { label: 'Time', value: `${timeRange} (${venue.timezone})` },
    { label: 'Guests', value: summary.party },
    { label: 'Reference', value: booking.reference ?? booking.id.slice(0, 8).toUpperCase() },
    { label: 'Seating', value: seatingLabel },
    { label: 'Type', value: bookingTypeLabel },
  ];

  if (venue.phone) {
    gridItems.push({
      label: 'Phone',
      value: venue.phone,
      isLink: true,
      href: `tel:${venue.phone}`,
    });
  }

  const contentHtml = `
    <div style="text-align:center;margin-bottom:32px;">
      ${renderBadge(statusPresentation.label, statusPresentation.badgeText, statusPresentation.badgeBg)}
      <h1 style="margin-top:16px;margin-bottom:12px;font-family:${EMAIL_FONT_STACK};font-size:24px;font-weight:700;color:${COLORS.text.main};line-height:1.3;">${escapeHtml(headline)}</h1>
      <p style="font-family:${EMAIL_FONT_STACK};font-size:16px;color:${COLORS.text.secondary};line-height:1.6;margin:0;">${escapeHtml(intro)}</p>
      ${statusPresentation.note ? `<p style="margin-top:12px;font-family:${EMAIL_FONT_STACK};font-size:14px;color:${COLORS.text.muted};line-height:1.5;">${escapeHtml(statusPresentation.note)}</p>` : ''}
    </div>

    ${ctaLabel && ctaUrl ? renderButton(ctaLabel, ctaUrl, { fullWidth: true }) : ''}

    ${renderQuickActions(quickActions)}

    ${renderDivider()}

    <h3 style="margin-bottom:20px;font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${COLORS.text.muted};">Reservation Details</h3>
    
    ${renderKeyValueGrid(gridItems)}

    ${
      notes
        ? `
      ${renderDivider()}
      <h3 style="margin-bottom:12px;font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:600;color:${COLORS.text.main};">Guest Notes</h3>
      <div style="background:${COLORS.background};padding:16px;border-radius:12px;">
        <p style="margin:0;font-family:${EMAIL_FONT_STACK};font-size:14px;color:${COLORS.text.secondary};line-height:1.6;">${escapeHtml(notes)}</p>
      </div>
    `
        : ''
    }

    ${renderDivider()}

    <div style="text-align:center;">
      <p style="margin:0 0 8px;font-family:${EMAIL_FONT_STACK};font-size:14px;font-weight:600;color:${COLORS.text.main};">${escapeHtml(venue.name)}</p>
      <p style="margin:0 0 8px;font-family:${EMAIL_FONT_STACK};font-size:14px;color:${COLORS.text.secondary};">${escapeHtml(venue.address)}</p>
      ${venue.policy ? `<p style="margin-top:16px;font-family:${EMAIL_FONT_STACK};font-size:12px;color:${COLORS.text.muted};line-height:1.5;">${escapeHtml(venue.policy)}</p>` : ''}
    </div>
  `;

  return renderEmailBase({
    title: headline,
    preheader,
    contentHtml,
    headerHtml: renderBrandHeader(venue),
  });
}

function renderText(
  booking: BookingRecord,
  venue: VenueDetails,
  summary: BookingSummary,
  headline: string,
  intro: string,
  options?: {
    calendarActionUrl?: string;
    walletActionUrl?: string;
    calendarAttachmentName?: string;
  },
) {
  const manageUrl = buildManageUrl(booking);
  const statusPresentation = getStatusPresentation(booking.status);
  const bookingTypeLabel = formatBookingTypeLabel(booking.booking_type);
  const seatingLabel = formatSeatingLabel(booking.seating_preference);
  const timeRange = summary.endTime
    ? `${summary.startTime} – ${summary.endTime}`
    : summary.startTime;
  const notes = booking.notes?.trim();

  const lines = [
    headline,
    '',
    intro,
    '',
    `Status: ${statusPresentation.label}`,
    statusPresentation.note,
    `Reference: ${booking.reference}`,
    `When: ${summary.date} at ${timeRange} (${venue.timezone})`,
    `Party: ${summary.party}`,
    `Booking type: ${bookingTypeLabel}`,
    `Seating: ${seatingLabel}`,
    `Lead guest: ${booking.customer_name} (${booking.customer_phone})`,
    '',
    `Restaurant: ${venue.name}`,
    `Address: ${venue.address}`,
    venue.googleMapUrl ? `Google Maps: ${venue.googleMapUrl}` : null,
    `Phone: ${venue.phone}`,
    `Email: ${venue.email}`,
    `Policy: ${venue.policy}`,
  ];

  const filteredLines = lines.filter((line): line is string => Boolean(line && line.length > 0));

  if (notes) {
    filteredLines.push('', `Guest notes: ${notes}`);
  }

  filteredLines.push('', `Manage this booking: ${manageUrl}`);

  if (options?.calendarActionUrl) {
    filteredLines.push('', `Add to calendar: ${options.calendarActionUrl}`);
  }

  if (options?.calendarAttachmentName) {
    filteredLines.push(`Calendar file attached: ${options.calendarAttachmentName}`);
  }

  if (options?.walletActionUrl) {
    filteredLines.push('', `Add to wallet/share: ${options.walletActionUrl}`);
  }

  return filteredLines.join('\n');
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

  let headline = '';
  let intro = '';
  let ctaLabel = 'Manage Booking';
  let ctaUrl = manageUrl;
  let toEmail = booking.customer_email;

  switch (type) {
    case 'created':
      if (isPending) {
        headline = 'Reservation Received';
        intro = `Hi ${guestFirstName}, we've received your request for ${venue.name}. We'll notify you as soon as the restaurant confirms your table.`;
      } else {
        headline = 'Reservation Confirmed';
        intro = `Hi ${guestFirstName}, your table at ${venue.name} is confirmed. We look forward to seeing you!`;
      }
      break;
    case 'updated':
      headline = 'Reservation Updated';
      intro = `Hi ${guestFirstName}, your reservation details for ${venue.name} have been updated.`;
      break;
    case 'cancelled':
      headline = 'Reservation Cancelled';
      intro = `Hi ${guestFirstName}, your reservation at ${venue.name} has been cancelled as requested.`;
      ctaLabel = 'Book Again';
      ctaUrl = bookingSiteUrl;
      break;
    case 'modification_pending':
      headline = 'Change Request Received';
      intro = `Hi ${guestFirstName}, we've received your request to change your reservation at ${venue.name}. We'll confirm shortly.`;
      break;
    case 'modification_confirmed':
      headline = 'Change Confirmed';
      intro = `Hi ${guestFirstName}, your reservation change at ${venue.name} has been confirmed.`;
      break;
    case 'booking_rejected':
      headline = 'Reservation Declined';
      intro = `Hi ${guestFirstName}, unfortunately ${venue.name} could not accommodate your request at this time.`;
      ctaLabel = 'Find Another Table';
      ctaUrl = bookingSiteUrl;
      break;
    case 'restaurant_cancellation':
      headline = 'Reservation Cancelled by Restaurant';
      intro = `Hi ${guestFirstName}, we're sorry but ${venue.name} had to cancel your reservation.`;
      ctaLabel = 'Find Another Table';
      ctaUrl = bookingSiteUrl;
      break;
    case 'review_request':
      headline = 'How was your meal?';
      intro = `Hi ${guestFirstName}, we hope you enjoyed your experience at ${venue.name}. We'd love to hear your feedback.`;
      ctaLabel = 'Leave a Review';
      ctaUrl = `${bookingSiteUrl}/reviews/${booking.id}`;
      break;
    case 'reminder':
      headline = 'Reservation Reminder';
      if (options?.reminderVariant === 'short') {
        intro = `Hi ${guestFirstName}, your table at ${venue.name} is ready for you soon. See you there!`;
      } else {
        intro = `Hi ${guestFirstName}, this is a reminder about your upcoming reservation at ${venue.name}. We look forward to welcoming you.`;
      }
      break;
    case 'pending_attention':
      headline = 'Action Required: Booking Pending';
      intro = `A booking at ${venue.name} requires attention. Reason: ${options?.reason ?? 'Manual assignment needed'}.`;
      ctaLabel = 'View in Dashboard';
      ctaUrl = `${bookingSiteUrl}/dashboard/bookings/${booking.id}`;
      toEmail = venue.email || config.email.supportEmail || ''; // Send to restaurant
      break;
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
  });

  const text = renderText(booking, venue, summary, headline, intro, {
    calendarAttachmentName,
  });

  if (!toEmail) {
    console.warn(
      `[emails][bookings] No recipient email found for type ${type} (booking ${booking.id})`,
    );
    return;
  }

  await sendEmail({
    to: toEmail,
    subject: `${headline} - ${venue.name}`,
    html,
    text,
    attachments,
    fromName: venue.name,
  });
}

export const sendBookingConfirmationEmail = (booking: BookingRecord) =>
  dispatchEmail('created', booking);
export const sendBookingUpdateEmail = (booking: BookingRecord) => dispatchEmail('updated', booking);
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
