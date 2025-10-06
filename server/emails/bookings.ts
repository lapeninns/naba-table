import config from "@/config";
import { env } from "@/lib/env";
import { DEFAULT_VENUE, type VenueDetails } from "@/lib/venue";
import { sendEmail } from "@/libs/resend";
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

function coalesceVenueField(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

async function resolveVenueDetails(restaurantId: string | null | undefined): Promise<VenueDetails> {
  if (!restaurantId) {
    return DEFAULT_VENUE;
  }

  try {
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
      return DEFAULT_VENUE;
    }

    if (!data) {
      return DEFAULT_VENUE;
    }

    return {
      id: data.id ?? restaurantId,
      name: coalesceVenueField(data.name, DEFAULT_VENUE.name),
      timezone: coalesceVenueField(data.timezone, DEFAULT_VENUE.timezone),
      address: coalesceVenueField(data.address, DEFAULT_VENUE.address),
      phone: coalesceVenueField(data.contact_phone, DEFAULT_VENUE.phone),
      email: coalesceVenueField(data.contact_email, DEFAULT_VENUE.email),
      policy: coalesceVenueField(data.booking_policy, DEFAULT_VENUE.policy),
    };
  } catch (error) {
    console.error("[emails][bookings] unexpected venue lookup error", { restaurantId, error });
    return DEFAULT_VENUE;
  }
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

  return `${siteUrl}/reserve?${params.toString()}`;
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
}: {
  booking: BookingRecord;
  venue: VenueDetails;
  summary: BookingSummary;
  headline: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const manageUrl = buildManageUrl(booking);
  const statusPresentation = getStatusPresentation(booking.status);
  const bookingTypeLabel = formatBookingTypeLabel(booking.booking_type);
  const seatingLabel = formatSeatingLabel(booking.seating_preference);
  const timeRange = summary.endTime ? `${summary.startTime} – ${summary.endTime}` : summary.startTime;
  const notes = booking.notes?.trim();
  const notesHtml = notes
    ? `
          <div style="margin-top:24px;padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Guest notes</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(notes)}</p>
          </div>
        `
    : "";
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
            <tr>
              <td align="center" style="padding:24px 0 0;">
                <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#4338ca;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;">${ctaLabel}</a>
              </td>
            </tr>
          `
      : "";

  return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f1f5f9; padding:32px; color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;">
        <div style="background:#111827;color:#f8fafc;padding:32px 32px 28px;border-radius:24px 24px 0 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;">
                <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a5b4fc;">${venue.name}</p>
                <h1 style="margin:0;font-size:28px;line-height:1.2;">${headline}</h1>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${statusPresentation.badgeBg};color:${statusPresentation.badgeText};font-weight:600;font-size:12px;border:1px solid ${statusPresentation.border};">${statusPresentation.label}</span>
                <p style="margin:12px 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;">Reference</p>
                <p style="margin:0;font-size:20px;font-weight:700;">${booking.reference}</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.7;color:#e0e7ff;">${intro}</p>
          <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#cbd5f5;">${statusPresentation.note}</p>
        </div>
        <div style="border-top:1px dashed #cbd5f5;background:#f1f5f9;height:16px;margin:0;">&nbsp;</div>
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 24px 24px;padding:32px;box-shadow:0 24px 40px -20px rgba(15,23,42,0.35);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="padding-right:16px;border-right:1px dashed #e2e8f0;vertical-align:top;width:55%;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">When</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;">${summary.date}</p>
                <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${timeRange}</p>
                <p style="margin:6px 0 18px;font-size:12px;color:#94a3b8;">${venue.timezone}</p>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Guests</p>
                <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#111827;">${summary.party}</p>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Booking type</p>
                <p style="margin:0 0 12px;font-size:14px;color:#334155;">${bookingTypeLabel}</p>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Seating</p>
                <p style="margin:0;font-size:14px;color:#334155;">${seatingLabel}</p>
                <p style="margin:16px 0 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Lead guest</p>
                <p style="margin:4px 0 0;font-size:14px;color:#334155;line-height:1.6;">${booking.customer_name}<br>${booking.customer_phone}</p>
              </td>
              <td style="padding-left:16px;vertical-align:top;width:45%;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Restaurant</p>
                <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#111827;">${venue.name}</p>
                <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Address</p>
                <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6;">${venue.address}</p>
                <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Phone</p>
                <p style="margin:0 0 16px;font-size:14px;color:#334155;">${venue.phone}</p>
                <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                <p style="margin:0 0 16px;font-size:14px;color:#334155;">${venue.email}</p>
                <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Policy</p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">${venue.policy}</p>
              </td>
            </tr>
          </table>
          ${notesHtml}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${ctaBlock}
            <tr>
              <td style="padding:32px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;" align="center">
                Manage your reservation anytime:
                <br />
                <a href="${manageUrl}" style="color:#4338ca;">${manageUrl}</a>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderText(booking: BookingRecord, venue: VenueDetails, summary: BookingSummary, headline: string, intro: string) {
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

  let subject = "";
  let headline = "";
  let intro = "";
  let ctaLabel: string | undefined;
  let ctaUrl: string | undefined;

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

  await sendEmail({
    to: booking.customer_email,
    subject,
    html: renderHtml({ booking, venue, summary, headline, intro, ctaLabel, ctaUrl }),
    text: renderText(booking, venue, summary, headline, intro),
    replyTo: config.mailgun.supportEmail,
    fromName: venue.name, // Use restaurant name as the sender name
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
