import { DEFAULT_VENUE } from "@shared/config/venue";

export type ReservationCalendarPayload = {
  reservationId: string;
  reference: string | null | undefined;
  guestName: string | null | undefined;
  guestEmail?: string | null | undefined;
  partySize: number | null | undefined;
  startAt: string | null | undefined;
  endAt?: string | null | undefined;
  venueName?: string | null | undefined;
  venueAddress?: string | null | undefined;
  venueTimezone?: string | null | undefined;
  venueEmail?: string | null | undefined;
  venuePhone?: string | null | undefined;
  status?: "confirmed" | "cancelled" | "pending";
  sequence?: number;
  bookingType?: string | null | undefined;
  notes?: string | null | undefined;
  manageUrl?: string | null | undefined;
};

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  email: string;
  slug?: string | null;
};

function normaliseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function cleanLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ensureReservationVenue(payload: ReservationCalendarPayload): ReservationVenue {
  return {
    name: payload.venueName || DEFAULT_VENUE.name,
    address: payload.venueAddress || DEFAULT_VENUE.address,
    timezone: payload.venueTimezone || DEFAULT_VENUE.timezone,
    email: payload.venueEmail || "no-reply@nabatable.com",
    slug: DEFAULT_VENUE.slug,
  };
}

export function buildCalendarEvent(payload: ReservationCalendarPayload): string | null {
  const startDate = normaliseDate(payload.startAt);
  if (!startDate) return null;
  const endDate = normaliseDate(payload.endAt) ?? new Date(startDate.getTime() + 90 * 60 * 1000);

  const venue = ensureReservationVenue(payload);
  const now = new Date();
  const toTimestamp = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  // Status mapping
  let status = "CONFIRMED";
  let method = "REQUEST";
  if (payload.status === "cancelled") {
    status = "CANCELLED";
    method = "CANCEL";
  }

  const sequence = payload.sequence ?? 0;
  const uid = `${payload.reservationId}@nabatable.com`;
  const detailLines = [
    `Reservation for ${payload.guestName || "Guest"}`,
    `Reference: ${payload.reference ?? "N/A"}`,
    `Party size: ${payload.partySize ?? 1}`,
    cleanLine(payload.bookingType) ? `Booking type: ${payload.bookingType}` : null,
    cleanLine(payload.notes) ? `Notes: ${payload.notes}` : null,
    cleanLine(payload.manageUrl) ? `Manage booking: ${payload.manageUrl}` : null,
    cleanLine(payload.venuePhone) ? `Venue phone: ${payload.venuePhone}` : null,
  ].filter((value): value is string => Boolean(value));
  const description = escapeIcsText(detailLines.join('\n'));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nab a Table//EN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toTimestamp(now)}`,
    `DTSTART:${toTimestamp(startDate)}`,
    `DTEND:${toTimestamp(endDate)}`,
    `SUMMARY:${escapeIcsText(`${venue.name} Reservation`)}`,
    `LOCATION:${escapeIcsText(venue.address)}`,
    `DESCRIPTION:${description}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    cleanLine(payload.manageUrl) ? `URL:${escapeIcsText(payload.manageUrl as string)}` : null,
    `ORGANIZER;CN="${escapeIcsText(venue.name)}":mailto:${escapeIcsText(venue.email)}`,
    ...(payload.guestEmail
      ? [`ATTENDEE;CN="${escapeIcsText(payload.guestName || "Guest")}";RSVP=TRUE:mailto:${escapeIcsText(payload.guestEmail)}`]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((value): value is string => Boolean(value));

  return lines.join("\r\n");
}

export function shouldAttachCalendarEventAttachment(params: {
  bookingStatus: string | null | undefined;
  isPending: boolean;
}): boolean {
  if (params.isPending) {
    return false;
  }

  return params.bookingStatus !== 'no_show';
}

export function resolveCalendarDates(payload: ReservationCalendarPayload): {
  start: Date | null;
  end: Date | null;
} {
  const start = normaliseDate(payload.startAt);
  const end = normaliseDate(payload.endAt) ?? (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  return { start, end };
}
