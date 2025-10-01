import config from "@/config";
import { DEFAULT_VENUE } from "@/lib/venue";
import { sendEmail } from "@/libs/resend";
import type { BookingRecord } from "@/server/bookings";
import {
  formatDateForInput,
  formatReservationDateShort,
  formatReservationTime,
  formatReservationTimeFromDate,
} from "@reserve/shared/formatting/booking";
import { normalizeTime } from "@reserve/shared/time";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

function buildSummary(booking: BookingRecord) {
  const startAt = parseTimestamp(booking.start_at);
  const endAt = parseTimestamp(booking.end_at);
  const { timezone } = DEFAULT_VENUE;

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
  headline,
  intro,
  ctaLabel,
  ctaUrl,
}: {
  booking: BookingRecord;
  headline: string;
  intro: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const summary = buildSummary(booking);
  const manageUrl = buildManageUrl(booking);

  return `
    <div style="font-family: Inter, Arial, sans-serif; background-color:#f8fafc; padding:24px; color:#0f172a;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 20px 25px -5px rgba(15, 23, 42, 0.08);">
        <p style="text-transform:uppercase;letter-spacing:0.14em;font-size:12px;color:#6366f1;margin:0 0 12px;">Booking reference ${booking.reference}</p>
        <h1 style="font-size:24px;margin:0 0 16px;">${headline}</h1>
        <p style="margin:0 0 24px;color:#475569;line-height:1.6;">${intro}</p>
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
          <h2 style="font-size:16px;margin:0 0 12px;">Reservation summary</h2>
          <table style="width:100%;font-size:14px;color:#334155;line-height:1.6;">
            <tbody>
              <tr><td style="padding:4px 0;">Guest</td><td style="text-align:right;font-weight:600;">${booking.customer_name}</td></tr>
              <tr><td style="padding:4px 0;">Date</td><td style="text-align:right;font-weight:600;">${summary.date}</td></tr>
              <tr><td style="padding:4px 0;">Time</td><td style="text-align:right;font-weight:600;">${summary.startTime} – ${summary.endTime}</td></tr>
              <tr><td style="padding:4px 0;">Party size</td><td style="text-align:right;font-weight:600;">${summary.party}</td></tr>
              <tr><td style="padding:4px 0;">Venue</td><td style="text-align:right;font-weight:600;">${DEFAULT_VENUE.name}</td></tr>
            </tbody>
          </table>
        </div>
        <div style="border:1px solid #cbd5f5;background:#eef2ff;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-weight:600;">Venue contact</p>
          <p style="margin:0;color:#4338ca;">${DEFAULT_VENUE.address}</p>
          <p style="margin:0;color:#4338ca;">Tel: ${DEFAULT_VENUE.phone}</p>
          <p style="margin:0;color:#4338ca;">Email: ${DEFAULT_VENUE.email}</p>
        </div>
        <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${DEFAULT_VENUE.policy}</p>
        ${
          ctaLabel && ctaUrl
            ? `<a href="${ctaUrl}" style="display:inline-block;background:#4338ca;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">${ctaLabel}</a>`
            : ""
        }
        <div style="margin-top:24px;font-size:12px;color:#94a3b8;line-height:1.6;">
          <p style="margin:0 0 4px;">Manage your reservation at any time:</p>
          <a href="${manageUrl}" style="color:#4338ca;">${manageUrl}</a>
        </div>
      </div>
    </div>
  `;
}

function renderText(booking: BookingRecord, headline: string, intro: string) {
  const summary = buildSummary(booking);
  const manageUrl = buildManageUrl(booking);

  return `${headline}\n\n${intro}\n\nBooking reference: ${booking.reference}\nGuest: ${booking.customer_name}\nDate: ${summary.date}\nTime: ${summary.startTime} – ${summary.endTime}\nParty: ${summary.party}\nVenue: ${DEFAULT_VENUE.name}\nPhone: ${DEFAULT_VENUE.phone}\nEmail: ${DEFAULT_VENUE.email}\n\nManage this booking: ${manageUrl}`;
}

async function dispatchEmail(
  type: "created" | "updated" | "cancelled",
  booking: BookingRecord,
) {
  const manageUrl = buildManageUrl(booking);
  const summary = buildSummary(booking);

  let subject = "";
  let headline = "";
  let intro = "";
  let ctaLabel: string | undefined;
  let ctaUrl: string | undefined;

  switch (type) {
    case "created":
      subject = `Your booking is confirmed – ${DEFAULT_VENUE.name}`;
      headline = `See you soon, ${booking.customer_name}`;
      intro = `We're looking forward to hosting you at ${DEFAULT_VENUE.name} on ${summary.date} at ${summary.startTime}. If you need to make changes or cancel, you can do so online using the link below.`;
      ctaLabel = "View booking";
      ctaUrl = manageUrl;
      break;
    case "updated":
      subject = `Booking updated – ${DEFAULT_VENUE.name}`;
      headline = `Your booking was updated`;
      intro = `Thanks for letting us know. Here are the latest details for your reservation at ${DEFAULT_VENUE.name}.`;
      ctaLabel = "Review updates";
      ctaUrl = manageUrl;
      break;
    case "cancelled":
      subject = `Booking cancelled – ${DEFAULT_VENUE.name}`;
      headline = `Your booking has been cancelled`;
      intro = `We've cancelled your reservation for ${summary.date} at ${summary.startTime}. If this was a mistake, please get in touch and we'll do our best to help.`;
      ctaLabel = undefined;
      ctaUrl = undefined;
      break;
  }

  await sendEmail({
    to: booking.customer_email,
    subject,
    html: renderHtml({ booking, headline, intro, ctaLabel, ctaUrl }),
    text: renderText(booking, headline, intro),
    replyTo: config.mailgun.supportEmail,
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
