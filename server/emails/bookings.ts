import config from "@/config";
import { env } from "@/lib/env";
import { buildCalendarEvent, type ReservationCalendarPayload } from "@/lib/reservations/calendar-event";
import { DEFAULT_VENUE, type VenueDetails } from "@/lib/venue";
import { sendEmail, type EmailAttachment } from "@/libs/resend";
import type { BookingRecord } from "@/server/bookings";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
  formatDateForInput,
  formatReservationDateShort,
  formatReservationTime,
  formatReservationTimeFromDate,
} from "@reserve/shared/formatting/booking";
import { normalizeTime } from "@reserve/shared/time";

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
  const { data, error } = await supabase
    .from("restaurants")
    .select("id,name,timezone,contact_email,contact_phone,address,booking_policy")
    .eq("id", restaurantId)
    .maybeSingle();

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

  return {
    id: data.id,
    name: data.name || "Restaurant",
    timezone: data.timezone || "Europe/London",
    address: data.address || "",
    phone: data.contact_phone || "",
    email: data.contact_email || "",
    policy: data.booking_policy || "",
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
  const notesHtml = notes
    ? `
          <div style="margin-top:28px;padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#0f172a;letter-spacing:0.08em;text-transform:uppercase;">Guest notes</p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">${escapeHtml(notes)}</p>
          </div>
        `
    : "";
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
            <tr>
              <td align="center" style="padding:28px 0 0;">
                <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;border-radius:999px;background:#4338ca;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;min-height:unset;" class="cta-button">${ctaLabel}</a>
              </td>
            </tr>
          `
      : "";

  const calendarButtons = calendarActionUrl || walletActionUrl
    ? `
            <tr>
              <td align="center" style="padding:24px 0 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" class="action-table" style="border-collapse:separate;">
                  <tr>
                    ${calendarActionUrl ? `
                      <td style="padding:0 6px 0 0;">
                        <a href="${calendarActionUrl}" class="action-pill" style="display:inline-block;padding:14px 28px;border-radius:999px;border:1px solid #d6e2f5;background:#ffffff;color:#0f172a;font-weight:600;font-size:14px;text-decoration:none;min-height:44px;">
                          <span class="action-pill-icon" style="margin-right:8px;font-size:16px;">📅</span>
                          <span class="action-pill-text" style="vertical-align:middle;">Add reservation to calendar</span>
                        </a>
                      </td>
                    ` : ""}
                    ${walletActionUrl ? `
                      <td style="padding:0 0 0 6px;">
                        <a href="${walletActionUrl}" class="action-pill" style="display:inline-block;padding:14px 28px;border-radius:999px;border:1px solid #d6e2f5;background:#ffffff;color:#0f172a;font-weight:600;font-size:14px;text-decoration:none;min-height:44px;">
                          <span class="action-pill-icon" style="margin-right:8px;font-size:16px;">💼</span>
                          <span class="action-pill-text" style="vertical-align:middle;">Add reservation to wallet</span>
                        </a>
                      </td>
                    ` : ""}
                  </tr>
                </table>
                ${calendarAttachmentName ? `<div style="margin-top:12px;font-size:12px;color:#64748b;">Calendar file attached: ${calendarAttachmentName}</div>` : ""}
              </td>
            </tr>
          `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${headline}</title>
      <!--[if mso]>
      <style type="text/css">
        table {border-collapse: collapse;}
      </style>
      <![endif]-->
      <style type="text/css">
        @media only screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            padding: 16px !important;
          }
          .email-header {
            padding: 24px 20px 20px !important;
            border-radius: 16px 16px 0 0 !important;
          }
          .email-body {
            padding: 20px !important;
            border-radius: 0 0 16px 16px !important;
          }
          .two-column {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            border: none !important;
          }
          .column-left {
            border-right: none !important;
            padding-right: 0 !important;
            padding-bottom: 24px !important;
            border-bottom: 1px dashed #e2e8f0 !important;
            width: 100% !important;
          }
          .column-right {
            padding-left: 0 !important;
            padding-top: 24px !important;
            width: 100% !important;
          }
          .header-table {
            display: block !important;
            width: 100% !important;
          }
          .header-left, .header-right {
            display: block !important;
            width: 100% !important;
            text-align: left !important;
            padding-bottom: 16px !important;
          }
          .header-right {
            text-align: left !important;
            padding-bottom: 0 !important;
          }
          .status-badge {
            display: inline-block !important;
            margin-bottom: 12px !important;
          }
          h1 {
            font-size: 24px !important;
            line-height: 1.3 !important;
          }
          .cta-button {
            display: block !important;
            width: 100% !important;
            padding: 16px 24px !important;
            font-size: 16px !important;
          }
          .action-table {
            width: 100% !important;
          }
          .action-table tr {
            display: block !important;
          }
          .action-table td {
            display: block !important;
            padding: 0 0 12px !important;
            width: 100% !important;
          }
          .action-pill {
            width: 100% !important;
            text-align: center !important;
          }
          .mobile-space {
            height: 12px !important;
          }
        }
        
        /* Touch-friendly targets */
        a {
          min-height: 44px;
          display: inline-block;
        }
        
        /* Prevent text resizing in iOS */
        body {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
      </style>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f1f5f9;color:#0f172a;line-height:1.5;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f1f5f9;padding:32px 16px;color:#0f172a;" class="email-container">
        <div style="max-width:600px;margin:0 auto;">
          <!-- Header -->
          <div style="background:#111827;color:#f8fafc;padding:32px 28px 24px;border-radius:24px 24px 0 0;" class="email-header">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;" class="header-table">
              <tr>
                <td style="vertical-align:top;" class="header-left">
                  <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#a5b4fc;">${venue.name}</p>
                  <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:700;">${headline}</h1>
                </td>
                <td style="text-align:right;vertical-align:top;" class="header-right">
                  <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:${statusPresentation.badgeBg};color:${statusPresentation.badgeText};font-weight:600;font-size:13px;border:1px solid ${statusPresentation.border};min-height:unset;" class="status-badge">${statusPresentation.label}</span>
                  <p style="margin:12px 0 4px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;">Reference</p>
                  <p style="margin:0;font-size:20px;font-weight:700;">${booking.reference}</p>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#e0e7ff;">${intro}</p>
            <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#cbd5f5;">${statusPresentation.note}</p>
          </div>
          
          <!-- Separator -->
          <div style="border-top:1px dashed #cbd5f5;background:#f1f5f9;height:16px;margin:0;" class="mobile-space">&nbsp;</div>
          
          <!-- Body -->
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 24px 24px;padding:32px 28px;box-shadow:0 24px 40px -20px rgba(15,23,42,0.35);" class="email-body">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;" class="two-column">
              <tr>
                <td style="padding-right:20px;border-right:1px dashed #e2e8f0;vertical-align:top;width:55%;" class="column-left">
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">When</p>
                  <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;line-height:1.3;">${summary.date}</p>
                  <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;font-weight:500;">${timeRange}</p>
                  <p style="margin:6px 0 20px;font-size:12px;color:#94a3b8;">${venue.timezone}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">Guests</p>
                  <p style="margin:0 0 20px;font-size:15px;font-weight:600;color:#111827;">${summary.party}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">Booking type</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#334155;">${bookingTypeLabel}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">Seating</p>
                  <p style="margin:0 0 20px;font-size:14px;color:#334155;">${seatingLabel}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">Lead guest</p>
                  <p style="margin:4px 0 0;font-size:14px;color:#334155;line-height:1.6;">${booking.customer_name}<br><a href="tel:${booking.customer_phone}" style="color:#4338ca;text-decoration:none;min-height:unset;">${booking.customer_phone}</a></p>
                </td>
                <td style="padding-left:20px;vertical-align:top;width:45%;" class="column-right">
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">Restaurant</p>
                  <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111827;line-height:1.3;">${venue.name}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Address</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">${venue.address}</p>
                  
                  <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Phone</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#334155;"><a href="tel:${venue.phone}" style="color:#4338ca;text-decoration:none;min-height:unset;">${venue.phone}</a></p>
                  
                  <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Email</p>
                  <p style="margin:0 0 16px;font-size:14px;color:#334155;word-break:break-word;"><a href="mailto:${venue.email}" style="color:#4338ca;text-decoration:none;min-height:unset;">${venue.email}</a></p>
                  
                  <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Policy</p>
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">${venue.policy}</p>
                </td>
              </tr>
            </table>
            ${notesHtml}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              ${calendarButtons}
              ${ctaBlock}
              <tr>
                <td style="padding:32px 0 0;font-size:12px;color:#94a3b8;line-height:1.7;" align="center">
                  <p style="margin:0 0 8px;">Manage your reservation anytime:</p>
                  <a href="${manageUrl}" style="color:#4338ca;word-break:break-all;min-height:unset;">${manageUrl}</a>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
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

async function dispatchEmail(
  type: "created" | "updated" | "cancelled",
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
    html: renderHtml({
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
    replyTo: config.mailgun.supportEmail,
    fromName: venue.name, // Use restaurant name as the sender name
    attachments: attachments.length ? attachments : undefined,
  });
}

export async function sendBookingConfirmationEmail(booking: BookingRecord) {
  await dispatchEmail("created", booking);
}

export async function sendBookingUpdateEmail(booking: BookingRecord) {
  await dispatchEmail("updated", booking);
}

export async function sendBookingCancellationEmail(booking: BookingRecord) {
  await dispatchEmail("cancelled", booking);
}
