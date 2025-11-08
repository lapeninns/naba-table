import config from "@/config";
import { env } from "@/lib/env";
import { buildCalendarEvent, type ReservationCalendarPayload } from "@/lib/reservations/calendar-event";
import { type VenueDetails } from "@/lib/venue";
import { sendEmail, type EmailAttachment } from "@/libs/resend";
import { renderButton, renderEmailBase } from "@/server/emails/base";
import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from "@/server/restaurants/logo-url-compat";
import { restaurantSelectColumns } from "@/server/restaurants/select-fields";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
  formatDateForInput,
  formatReservationDateShort,
  formatReservationTime,
  formatReservationTimeFromDate,
} from "@reserve/shared/formatting/booking";
import { normalizeTime } from "@reserve/shared/time";

import type { BookingRecord } from "@/server/bookings";
import type { Database } from "@/types/supabase";

type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

const siteUrl = env.app.url;

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
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatBookingTypeLabel(value: string | null | undefined) {
  return titleize(value) || "Dining";
}

function formatSeatingLabel(value: string | null | undefined) {
  if (!value || value === "any") return "Any available";
  return titleize(value);
}

async function resolveVenueDetails(restaurantId: string | null | undefined): Promise<VenueDetails> {
  if (!restaurantId) {
    throw new Error("[emails][bookings] restaurantId is required");
  }

  const supabase = getServiceSupabaseClient();
  const execute = (includeLogo: boolean) =>
    supabase
      .from("restaurants")
      .select(restaurantSelectColumns(includeLogo))
      .eq("id", restaurantId)
      .maybeSingle<RestaurantRow>();

  let { data, error } = await execute(true);

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback("resolveVenueDetails");
    ({ data, error } = await execute(false));
    data = ensureLogoColumnOnRow(data);
  }

  if (error) {
    console.error("[emails][bookings] venue lookup failed", {
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
    name: restaurant.name || "Restaurant",
    timezone: restaurant.timezone || "Europe/London",
    address: restaurant.address || "",
    phone: restaurant.contact_phone || "",
    email: restaurant.contact_email || "",
    policy: restaurant.booking_policy || "",
    logoUrl: restaurant.logo_url || null,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type StatusPresentation = {
  label: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  note: string;
};

const STATUS_PRESENTATION: Record<BookingRecord["status"], StatusPresentation> = {
  confirmed: {
    label: "Confirmed",
    badgeBg: "#dcfce7",
    badgeText: "#166534",
    border: "#22c55e",
    note: "Show this ticket on arrival and we will take care of the rest.",
  },
  pending: {
    label: "Awaiting confirmation",
    badgeBg: "#fef9c3",
    badgeText: "#854d0e",
    border: "#f59e0b",
    note: "We will follow up as soon as the restaurant confirms your table.",
  },
  pending_allocation: {
    label: "Allocation in progress",
    badgeBg: "#fef9c3",
    badgeText: "#854d0e",
    border: "#f59e0b",
    note: "You're on the list and we are securing the best table for your party.",
  },
  checked_in: {
    label: "Checked in",
    badgeBg: "#dcfce7",
    badgeText: "#166534",
    border: "#22c55e",
    note: "Thanks for arriving on time. We hope you enjoy your experience.",
  },
  cancelled: {
    label: "Cancelled",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    border: "#ef4444",
    note: "Keep this for your records. Let us know if you need to book again.",
  },
  completed: {
    label: "Completed",
    badgeBg: "#dbeafe",
    badgeText: "#1d4ed8",
    border: "#3b82f6",
    note: "Thanks for dining with us. We hope to welcome you back soon.",
  },
  no_show: {
    label: "No show",
    badgeBg: "#fee2e2",
    badgeText: "#b91c1c",
    border: "#ef4444",
    note: "We missed you this time. Reach out if you'd like to rebook.",
  },
};

function getStatusPresentation(status: BookingRecord["status"] | string): StatusPresentation {
  return STATUS_PRESENTATION[(status as BookingRecord["status"]) ?? "confirmed"] ?? STATUS_PRESENTATION.confirmed;
}

function buildManageUrl(booking: BookingRecord) {
  const params = new URLSearchParams({
    view: "manage",
    email: booking.customer_email,
    phone: booking.customer_phone,
  });

  if (booking.restaurant_id) {
    params.set("restaurantId", booking.restaurant_id);
  }

  const query = params.toString();
  return query ? `${siteUrl}/?${query}` : `${siteUrl}/`;
}

function buildCalendarPayload(booking: BookingRecord, venue: VenueDetails): ReservationCalendarPayload {
  const startAt = parseTimestamp(booking.start_at);
  const endAt = parseTimestamp(booking.end_at);

  return {
    reservationId: booking.id,
    reference: booking.reference,
    guestName: booking.customer_name,
    partySize: booking.party_size,
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    venueName: venue.name,
    venueAddress: venue.address,
    venueTimezone: venue.timezone,
  };
}

function buildActionUrl(baseUrl: string, action: "calendar" | "wallet") {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("action", action);
    return url.toString();
  } catch (error) {
    console.error("[emails][bookings] failed to build action url", error);
    return baseUrl;
  }
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
  const party = `${booking.party_size} ${booking.party_size === 1 ? "guest" : "guests"}`;

  return { date, startTime, endTime, party };
}

const EMAIL_FONT_STACK = "'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const EMAIL_BACKGROUND = "#eef2ff";

function renderActionButton(
  label: string,
  href: string,
  options: { icon?: string; variant?: 'primary' | 'secondary' } = {},
): string {
  const { icon, variant = 'primary' } = options;
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  const isPrimary = variant === 'primary';
  const background = isPrimary ? '#4338ca' : '#ffffff';
  const color = isPrimary ? '#ffffff' : '#111827';
  const border = isPrimary ? 'border:0;' : 'border:1px solid #dbe4ff;';
  const iconHtml = icon
    ? `<span aria-hidden="true" style="font-size:16px;line-height:1;margin-right:8px;display:inline-block;">${icon}</span>`
    : '';

  return `<a href="${safeHref}" style="${border}display:inline-block;padding:14px 28px;border-radius:999px;background:${background};color:${color};font-family:${EMAIL_FONT_STACK};font-weight:600;font-size:15px;text-decoration:none;min-height:44px;line-height:1.35;">${iconHtml}<span style="vertical-align:middle;">${safeLabel}</span></a>`;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function renderHtml({
  booking,
  venue,
  summary,
  headline,
  intro,
  ctaLabel,
  ctaUrl,
  calendarActionUrl,
  walletActionUrl,
  calendarAttachmentName,
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
  const timeRange = summary.endTime ? `${summary.startTime} – ${summary.endTime}` : summary.startTime;
  const notes = booking.notes?.trim();
  const preheader = `${summary.date} at ${summary.startTime}${summary.endTime ? ` · Ends ${summary.endTime}` : ''} · ${venue.name}`;
  const secondaryButtons: string[] = [];
  if (calendarActionUrl) {
    secondaryButtons.push(renderActionButton('Add reservation to calendar', calendarActionUrl, { variant: 'secondary', icon: '📅' }));
  }
  if (walletActionUrl) {
    secondaryButtons.push(renderActionButton('Add reservation to wallet', walletActionUrl, { variant: 'secondary', icon: '💼' }));
  }

  const secondaryActionsHtml = secondaryButtons.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="action-group" style="margin-top:24px;border-collapse:separate;">
        <tr>
          ${secondaryButtons.map((button) => `<td class="action-cell" style="padding:0 6px 12px;text-align:center;">${button}</td>`).join('')}
        </tr>
      </table>
      ${calendarAttachmentName ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#64748b;font-family:${EMAIL_FONT_STACK};">Calendar file attached: ${escapeHtml(calendarAttachmentName)}</p>` : ''}`
    : calendarAttachmentName
      ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b;font-family:${EMAIL_FONT_STACK};">Calendar file attached: ${escapeHtml(calendarAttachmentName)}</p>`
      : '';

  const notesHtml = notes
    ? `<tr>
        <td style="padding:0 36px 32px;">
          <div style="margin-top:16px;padding:18px 20px;border-radius:18px;border:1px solid #e2e8f0;background:#f8fafc;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#475569;font-family:${EMAIL_FONT_STACK};">Guest notes</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;font-family:${EMAIL_FONT_STACK};">${escapeHtml(notes)}</p>
          </div>
        </td>
      </tr>`
    : '';

  const primaryButton = ctaLabel && ctaUrl ? renderActionButton(ctaLabel, ctaUrl, { variant: 'primary', icon: '➡️' }) : '';

  const supportEmail = venue.email?.trim() || config.email.supportEmail || '';
  const supportPhone = venue.phone?.trim() || '';
  const supportLine = [
    supportEmail ? `Email <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4338ca;text-decoration:none;">${escapeHtml(supportEmail)}</a>` : '',
    supportPhone ? `Call ${escapeHtml(supportPhone)}` : '',
  ].filter(Boolean).join(' · ');

  const customerPhone = booking.customer_phone?.trim();
  const customerPhoneHref = customerPhone ? `tel:${encodeURIComponent(customerPhone)}` : null;
  const venuePhone = venue.phone?.trim();
  const venuePhoneHref = venuePhone ? `tel:${encodeURIComponent(venuePhone)}` : null;
  const venueEmailHref = venue.email ? `mailto:${escapeHtml(venue.email)}` : null;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${escapeHtml(headline)}</title>
      <style type="text/css">
        @media only screen and (max-width: 600px) {
          .email-shell {
            padding: 24px 12px !important;
          }
          .card {
            border-radius: 24px !important;
          }
          .stack-column,
          .stack-column table,
          .stack-column tbody,
          .stack-column tr,
          .stack-column td {
            display: block !important;
            width: 100% !important;
          }
          .stack-column {
            padding: 0 !important;
            border: none !important;
          }
          .stack-column + .stack-column {
            margin-top: 24px !important;
            border-top: 1px solid #e2e8f0 !important;
            padding-top: 24px !important;
          }
          .action-cell {
            display: block !important;
            width: 100% !important;
            padding: 0 0 12px !important;
          }
          .action-group {
            margin-top: 20px !important;
          }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background:${EMAIL_BACKGROUND};">
      <div role="article" aria-roledescription="email" aria-label="${escapeHtml(headline)}" lang="en">
        <div style="display:none;max-height:0;overflow:hidden;color:transparent;line-height:1;font-size:1px;">${escapeHtml(preheader)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BACKGROUND};padding:32px 16px;" class="email-shell">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-radius:28px;background:#ffffff;overflow:hidden;box-shadow:0 24px 40px -28px rgba(15,23,42,0.45);" class="card">
                <tr>
                  <td style="padding:32px 36px 28px;background:linear-gradient(135deg,#1f2937,#111827);color:#e5edff;font-family:${EMAIL_FONT_STACK};">
                    <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid ${statusPresentation.border};background:${statusPresentation.badgeBg};color:${statusPresentation.badgeText};font-weight:600;font-size:13px;">${escapeHtml(statusPresentation.label)}</span>
                    <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.25;font-weight:700;color:#ffffff;">${escapeHtml(headline)}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#e5edff;">${escapeHtml(intro)}</p>
                    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#c7cffd;">${escapeHtml(statusPresentation.note)}</p>
                    ${primaryButton ? `<div style="margin-top:24px;">${primaryButton}</div>` : ''}
                    ${secondaryActionsHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 36px 32px;font-family:${EMAIL_FONT_STACK};color:#0f172a;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="stack-column" style="width:50%;padding:28px 18px 0 0;vertical-align:top;border-right:1px solid #e2e8f0;">
                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">When</p>
                          <p style="margin:0 0 6px;font-size:18px;font-weight:600;">${escapeHtml(summary.date)}</p>
                          <p style="margin:0 0 16px;font-size:15px;color:#334155;">${escapeHtml(timeRange)}</p>
                          <p style="margin:0 0 18px;font-size:12px;color:#94a3b8;">${escapeHtml(venue.timezone)}</p>

                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">Guests</p>
                          <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(summary.party)}</p>

                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">Booking type</p>
                          <p style="margin:0 0 18px;font-size:14px;color:#334155;">${escapeHtml(bookingTypeLabel)}</p>

                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">Seating</p>
                          <p style="margin:0 0 18px;font-size:14px;color:#334155;">${escapeHtml(seatingLabel)}</p>

                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">Lead guest</p>
                          <p style="margin:0;font-size:14px;color:#0f172a;">${escapeHtml(booking.customer_name)}</p>
                          ${booking.customer_email ? `<p style="margin:4px 0 0;font-size:14px;color:#475569;">${escapeHtml(booking.customer_email)}</p>` : ''}
                          ${customerPhone ? `<p style="margin:4px 0 0;font-size:14px;"><a href="${customerPhoneHref}" style="color:#4338ca;text-decoration:none;">${escapeHtml(customerPhone)}</a></p>` : ''}
                        </td>
                        <td class="stack-column" style="width:50%;padding:28px 0 0 18px;vertical-align:top;">
                          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#64748b;">Restaurant</p>
                          <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111827;">${escapeHtml(venue.name)}</p>

                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Address</p>
                          <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(venue.address)}</p>

                          ${venuePhone ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Phone</p><p style="margin:0 0 16px;font-size:14px;"><a href="${venuePhoneHref}" style="color:#4338ca;text-decoration:none;">${escapeHtml(venuePhone)}</a></p>` : ''}

                          ${venue.email ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Email</p><p style="margin:0 0 16px;font-size:14px;"><a href="${venueEmailHref}" style="color:#4338ca;text-decoration:none;word-break:break-word;">${escapeHtml(venue.email)}</a></p>` : ''}

                          ${venue.policy ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Policy</p><p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">${escapeHtml(venue.policy)}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${notesHtml}
                <tr>
                  <td style="padding:0 36px 36px;font-family:${EMAIL_FONT_STACK};">
                    <hr style="border:none;height:1px;background:#e2e8f0;margin:0 0 24px;">
                    <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#94a3b8;">Manage your reservation anytime:</p>
                    <p style="margin:0;font-size:12px;line-height:1.6;">
                      <a href="${escapeHtml(manageUrl)}" style="color:#4338ca;text-decoration:none;word-break:break-all;">${escapeHtml(manageUrl)}</a>
                    </p>
                    ${supportLine ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Need help? ${supportLine}.</p>` : ''}
                    <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#b0b9d6;">You received this email because you made a reservation through SajiloReserveX. Times are local to the venue.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;
}

/* eslint-enable @typescript-eslint/no-unused-vars */

function renderBrandHeader(venue: VenueDetails) {
  const safeName = escapeHtml(venue.name);
  if (venue.logoUrl) {
    const safeLogo = escapeHtml(venue.logoUrl);
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <img src="${safeLogo}" alt="${safeName} logo" width="92" style="max-width:96px;height:auto;border-radius:20px;border:1px solid #e2e8f0;padding:12px;background:#ffffff;box-shadow:0 8px 30px rgba(15,23,42,0.08);" />
        </td>
      </tr>
      <tr>
        <td align="center" style="font-family:${EMAIL_FONT_STACK};font-size:13px;color:#64748b;">${safeName}</td>
      </tr>
    </table>`;
  }

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding-bottom:12px;">
        <span style="display:inline-block;padding:10px 22px;border-radius:999px;background:#eef2ff;color:#4338ca;font-family:${EMAIL_FONT_STACK};font-weight:600;font-size:14px;">${safeName}</span>
      </td>
    </tr>
  </table>`;
}

// New responsive, bulletproof, base-wrapped template
function renderHtmlRevamp({
  booking,
  venue,
  summary,
  headline,
  intro,
  ctaLabel,
  ctaUrl,
  calendarActionUrl,
  walletActionUrl,
  calendarAttachmentName,
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
  const timeRange = summary.endTime ? `${summary.startTime} – ${summary.endTime}` : summary.startTime;
  const notes = booking.notes?.trim();
  const preheader = `${summary.date} at ${summary.startTime}${summary.endTime ? ` · Ends ${summary.endTime}` : ''} · ${venue.name}`;

  const secondaryButtons: string[] = [];
  if (calendarActionUrl) secondaryButtons.push(renderButton('📅 Add reservation to calendar', calendarActionUrl, { variant: 'secondary', align: 'left' }));
  if (walletActionUrl) secondaryButtons.push(renderButton('💼 Add reservation to wallet', walletActionUrl, { variant: 'secondary', align: 'left' }));

  const secondaryActionsHtml = secondaryButtons.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="action-group" style="margin-top:24px;border-collapse:separate;">
        <tr>
          ${secondaryButtons.map((button) => `<td class="action-cell" style="padding:0 6px 12px;text-align:center;">${button}</td>`).join('')}
        </tr>
      </table>
      ${calendarAttachmentName ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Calendar file attached: ${escapeHtml(calendarAttachmentName)}</p>` : ''}`
    : calendarAttachmentName
      ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Calendar file attached: ${escapeHtml(calendarAttachmentName)}</p>`
      : '';

  const supportEmail = venue.email?.trim() || config.email.supportEmail || '';
  const supportPhone = venue.phone?.trim() || '';
  const supportLine = [
    supportEmail ? `Email <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4338ca;text-decoration:none;">${escapeHtml(supportEmail)}</a>` : '',
    supportPhone ? `Call ${escapeHtml(supportPhone)}` : '',
  ].filter(Boolean).join(' · ');

  const customerPhone = booking.customer_phone?.trim();
  const customerPhoneHref = customerPhone ? `tel:${encodeURIComponent(customerPhone)}` : null;
  const venuePhone = venue.phone?.trim();
  const venuePhoneHref = venuePhone ? `tel:${encodeURIComponent(venuePhone)}` : null;
  const venueEmailHref = venue.email ? `mailto:${escapeHtml(venue.email)}` : null;

  const notesHtml = notes
    ? `<tr>
        <td style="padding:0 36px 32px;">
          <div style="margin-top:16px;padding:18px 20px;border-radius:18px;border:1px solid #e2e8f0;background:#f8fafc;">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;color:#475569;">Guest notes</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(notes)}</p>
          </div>
        </td>
      </tr>`
    : '';

  const primaryButton = ctaLabel && ctaUrl ? renderButton(ctaLabel, ctaUrl, { variant: 'primary', align: 'center' }) : '';

  const contentHtml = `
      <div class="card">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(165deg,#6366f1,#4338ca);">
          <tr>
            <td style="padding:28px 24px 24px 24px;">
              <span style="display:inline-block;padding:6px 14px;border-radius:999px;border:1px solid ${statusPresentation.border};background:${statusPresentation.badgeBg};color:${statusPresentation.badgeText};font-weight:600;font-size:13px;">${escapeHtml(statusPresentation.label)}</span>
              <h1 style="margin:18px 0 10px;font-size:28px;line-height:1.25;font-weight:700;color:#ffffff;">${escapeHtml(headline)}</h1>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#e5edff;">${escapeHtml(intro)}</p>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#c7cffd;">${escapeHtml(statusPresentation.note)}</p>
              ${secondaryActionsHtml}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="stack-column" valign="top" width="50%" style="padding:12px 18px 0 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:0 0 10px 0;border-bottom:1px solid #f1f5f9;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Date</p>
                          <p style="margin:0 0 6px;font-size:18px;font-weight:600;">${escapeHtml(summary.date)}</p>
                          <p style="margin:0 0 16px;font-size:15px;color:#334155;">${escapeHtml(timeRange)}</p>
                          <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;">${escapeHtml(venue.timezone)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 0 0 0;border-bottom:1px solid #f1f5f9;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Party</p>
                          <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(summary.party)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 0 0 0;border-bottom:1px solid #f1f5f9;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Type</p>
                          <p style="margin:0 0 18px;font-size:14px;color:#334155;">${escapeHtml(bookingTypeLabel)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 0 0 0;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Seating</p>
                          <p style="margin:0 0 18px;font-size:14px;color:#334155;">${escapeHtml(seatingLabel)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="stack-column" valign="top" width="50%" style="padding:12px 18px 0 18px;border-left:1px dashed #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:0 0 10px 0;border-bottom:1px solid #f1f5f9;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Guest</p>
                          <p style="margin:0;font-size:14px;color:#0f172a;">${escapeHtml(booking.customer_name)}</p>
                          ${booking.customer_email ? `<p style="margin:4px 0 0;font-size:14px;color:#475569;">${escapeHtml(booking.customer_email)}</p>` : ''}
                          ${customerPhone ? `<p style="margin:4px 0 0;font-size:14px;"><a href="${customerPhoneHref}" style="color:#4338ca;text-decoration:none;">${escapeHtml(customerPhone)}</a></p>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 0 0 0;border-bottom:1px solid #f1f5f9;">
                          <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Venue</p>
                          <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111827;">${escapeHtml(venue.name)}</p>
                          <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">${escapeHtml(venue.address)}</p>
                          ${venuePhone ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Phone</p><p style="margin:0 0 16px;font-size:14px;"><a href="${venuePhoneHref}" style="color:#4338ca;text-decoration:none;">${escapeHtml(venuePhone)}</a></p>` : ''}
                          ${venue.email ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Email</p><p style="margin:0 0 16px;font-size:14px;"><a href="${venueEmailHref}" style="color:#4338ca;text-decoration:none;word-break:break-word;">${escapeHtml(venue.email)}</a></p>` : ''}
                          ${venue.policy ? `<p style="margin:0 0 6px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Policy</p><p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">${escapeHtml(venue.policy)}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${notesHtml}
          <tr>
            <td style="padding:0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:0 24px 24px;" align="center">
                    ${primaryButton}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 0;">
                    <div style="margin-top:16px;padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Share / Manage booking</p>
                      <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#111827;word-break:break-all;">
                        <a href="${escapeHtml(manageUrl)}" style="color:#4338ca;text-decoration:none;word-break:break-all;">${escapeHtml(manageUrl)}</a>
                      </p>
                      ${supportLine ? `<p style="margin:10px 0 0;font-size:13px;color:#64748b;">Need help? ${supportLine}</p>` : ''}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`;

  return renderEmailBase({
    title: headline,
    preheader,
    contentHtml,
    backgroundColor: EMAIL_BACKGROUND,
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
  const timeRange = summary.endTime ? `${summary.startTime} – ${summary.endTime}` : summary.startTime;
  const notes = booking.notes?.trim();

  const lines = [
    headline,
    "",
    intro,
    "",
    `Status: ${statusPresentation.label}`,
    statusPresentation.note,
    `Reference: ${booking.reference}`,
    `When: ${summary.date} at ${timeRange} (${venue.timezone})`,
    `Party: ${summary.party}`,
    `Booking type: ${bookingTypeLabel}`,
    `Seating: ${seatingLabel}`,
    `Lead guest: ${booking.customer_name} (${booking.customer_phone})`,
    "",
    `Restaurant: ${venue.name}`,
    `Address: ${venue.address}`,
    `Phone: ${venue.phone}`,
    `Email: ${venue.email}`,
    `Policy: ${venue.policy}`,
  ];

  if (notes) {
    lines.push("", `Guest notes: ${notes}`);
  }

  lines.push("", `Manage this booking: ${manageUrl}`);

  if (options?.calendarActionUrl) {
    lines.push("", `Add to calendar: ${options.calendarActionUrl}`);
  }

  if (options?.calendarAttachmentName) {
    lines.push(`Calendar file attached: ${options.calendarAttachmentName}`);
  }

  if (options?.walletActionUrl) {
    lines.push("", `Add to wallet/share: ${options.walletActionUrl}`);
  }

  return lines.join("\n");
}

type BookingEmailType =
  | "created"
  | "updated"
  | "cancelled"
  | "modification_pending"
  | "modification_confirmed";

async function dispatchEmail(
  type: BookingEmailType,
  booking: BookingRecord,
) {
  const venue = await resolveVenueDetails(booking.restaurant_id);
  const manageUrl = buildManageUrl(booking);
  const summary = buildSummary(booking, venue);
  const guestFirstName = booking.customer_name.split(/\s+/)[0] || booking.customer_name;
  const isPending = booking.status === "pending" || booking.status === "pending_allocation";
  const calendarPayload = buildCalendarPayload(booking, venue);
  const calendarEventContent = buildCalendarEvent(calendarPayload);
  const attachments: EmailAttachment[] = [];

  let calendarAttachmentName: string | undefined;
  if (calendarEventContent && !isPending) {
    const venueSlug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "reservation";
    calendarAttachmentName = `${venueSlug}-${booking.reference ?? booking.id}.ics`;
    attachments.push({
      filename: calendarAttachmentName,
      content: calendarEventContent,
      type: "text/calendar",
    });
  }

  let subject = "";
  let headline = "";
  let intro = "";
  let ctaLabel: string | undefined;
  let ctaUrl: string | undefined;
  let calendarActionUrl: string | undefined;
  let walletActionUrl: string | undefined;

  switch (type) {
    case "created":
      if (isPending) {
        subject = `Reservation request received – ${venue.name}`;
        headline = `${guestFirstName}, your reservation request`;
        intro = `We're lining up a table for ${summary.date} at ${summary.startTime}. Keep this ticket handy – it will update as soon as your reservation is confirmed.`;
      } else {
        subject = `Your reservation ticket – ${venue.name}`;
        headline = `${guestFirstName}, your reservation ticket`;
        intro = `Thanks for reserving a table at ${venue.name}. We'll be ready for you on ${summary.date} at ${summary.startTime}.`;
      }
      ctaLabel = "View booking";
      ctaUrl = manageUrl;
      break;
    case "updated":
      subject = `Reservation updated – ${venue.name}`;
      headline = `Your ticket was refreshed`;
      intro = `We've updated your reservation. The ticket below reflects the latest plan for ${summary.date} at ${summary.startTime}.`;
      ctaLabel = "Review updates";
      ctaUrl = manageUrl;
      break;
    case "modification_pending":
      subject = `Reservation modification requested – ${venue.name}`;
      headline = `We're updating your booking`;
      intro = `Thanks for the update. Your ${summary.date} ${summary.startTime} reservation is now awaiting a new table assignment. We'll confirm as soon as a table is secured.`;
      ctaLabel = "Track request";
      ctaUrl = manageUrl;
      break;
    case "modification_confirmed":
      subject = `Reservation modified – ${venue.name}`;
      headline = `Your reservation has been updated`;
      intro = `Great news—your updated plan for ${summary.date} at ${summary.startTime} is confirmed. The ticket below reflects the new details.`;
      ctaLabel = "View updated ticket";
      ctaUrl = manageUrl;
      break;
    case "cancelled":
      subject = `Booking cancelled – ${venue.name}`;
      headline = `Reservation cancelled`;
      intro = `We've cancelled your reservation for ${summary.date} at ${summary.startTime}. Keep this for your records and reply if you'd like help rebooking.`;
      ctaLabel = undefined;
      ctaUrl = undefined;
      break;
  }

  if (type !== "cancelled") {
    walletActionUrl = buildActionUrl(manageUrl, "wallet");
    if (calendarEventContent) {
      calendarActionUrl = buildActionUrl(manageUrl, "calendar");
    }
  }

  await sendEmail({
    to: booking.customer_email,
    subject,
    html: renderHtmlRevamp({
      booking,
      venue,
      summary,
      headline,
      intro,
      ctaLabel,
      ctaUrl,
      calendarActionUrl,
      walletActionUrl,
      calendarAttachmentName,
    }),
    text: renderText(booking, venue, summary, headline, intro, {
      calendarActionUrl,
      walletActionUrl,
      calendarAttachmentName,
    }),
    replyTo: config.email.supportEmail,
    fromName: venue.name, // Use restaurant name as the sender name
    attachments: attachments.length ? attachments : undefined,
  });
}

export async function sendBookingConfirmationEmail(booking: BookingRecord) {
  await dispatchEmail("created", booking);
}

// Exported for preview/testing harnesses
export { renderHtmlRevamp as renderBookingEmailHtml };

export async function sendBookingUpdateEmail(booking: BookingRecord) {
  await dispatchEmail("updated", booking);
}

export async function sendBookingCancellationEmail(booking: BookingRecord) {
  await dispatchEmail("cancelled", booking);
}

export async function sendBookingModificationPendingEmail(booking: BookingRecord) {
  await dispatchEmail("modification_pending", booking);
}

export async function sendBookingModificationConfirmedEmail(booking: BookingRecord) {
  await dispatchEmail("modification_confirmed", booking);
}
