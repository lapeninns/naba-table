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
  status?: "confirmed" | "cancelled" | "pending";
  sequence?: number;
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
    `SUMMARY:${venue.name} Reservation`,
    `LOCATION:${venue.address}`,
    `DESCRIPTION:Reservation for ${payload.guestName || "Guest"} (${payload.partySize ?? 1} guests).\nReference: ${payload.reference ?? "N/A"}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    `ORGANIZER;CN="${venue.name}":mailto:${venue.email}`,
    ...(payload.guestEmail ? [`ATTENDEE;CN="${payload.guestName || "Guest"}";RSVP=TRUE:mailto:${payload.guestEmail}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

export function resolveCalendarDates(payload: ReservationCalendarPayload): {
  start: Date | null;
  end: Date | null;
} {
  const start = normaliseDate(payload.startAt);
  const end = normaliseDate(payload.endAt) ?? (start ? new Date(start.getTime() + 90 * 60 * 1000) : null);
  return { start, end };
}
