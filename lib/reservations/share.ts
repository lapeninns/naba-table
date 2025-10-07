"use client";

import { DEFAULT_VENUE } from "@shared/config/venue";
import {
  formatReservationSummaryDate,
  formatReservationTimeFromDate,
} from "@reserve/shared/formatting/booking";

export type ReservationSharePayload = {
  reservationId: string;
  reference: string | null | undefined;
  guestName: string | null | undefined;
  partySize: number | null | undefined;
  startAt: string | null | undefined;
  endAt?: string | null | undefined;
  venueName?: string | null | undefined;
  venueAddress?: string | null | undefined;
  venueTimezone?: string | null | undefined;
};

export type ShareResult =
  | { variant: "success"; message: string }
  | { variant: "info"; message: string }
  | { variant: "warning"; message: string }
  | { variant: "error"; message: string };

const DEFAULT_SUCCESS_MESSAGE =
  "Calendar event downloaded. Check your downloads folder to import it.";

const DEFAULT_SHARE_TITLE = "Reservation details";

function normaliseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function ensureVenue(payload: ReservationSharePayload) {
  return {
    name: payload.venueName || DEFAULT_VENUE.name,
    address: payload.venueAddress || DEFAULT_VENUE.address,
    timezone: payload.venueTimezone || DEFAULT_VENUE.timezone,
  };
}

export function buildCalendarEvent(payload: ReservationSharePayload): string | null {
  const startDate = normaliseDate(payload.startAt);
  if (!startDate) return null;
  const endDate = normaliseDate(payload.endAt) ?? new Date(startDate.getTime() + 90 * 60 * 1000);

  const venue = ensureVenue(payload);

  const toTimestamp = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SajiloReserveX//EN",
    "BEGIN:VEVENT",
    `UID:${payload.reservationId}@sajiloreservex`,
    `DTSTAMP:${toTimestamp(new Date())}`,
    `DTSTART:${toTimestamp(startDate)}`,
    `DTEND:${toTimestamp(endDate)}`,
    `SUMMARY:${venue.name} reservation`,
    `LOCATION:${venue.address}`,
    `DESCRIPTION:Reservation for ${
      payload.guestName || "guest"
    } (${payload.partySize ?? 1} guests)`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

export function downloadCalendarEvent(payload: ReservationSharePayload): ShareResult {
  const event = buildCalendarEvent(payload);
  if (!event) {
    return {
      variant: "warning",
      message: "Select a confirmed date and time before adding this to your calendar.",
    };
  }

  try {
    const blob = new Blob([event], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const venue = ensureVenue(payload);
    const slug = venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    anchor.href = url;
    anchor.download = `${slug || "reservation"}-${payload.reference ?? payload.reservationId}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return { variant: "success", message: DEFAULT_SUCCESS_MESSAGE };
  } catch (error) {
    console.error("[reservation-share] failed to download ICS", error);
    return {
      variant: "error",
      message: "We couldn't download the calendar file. Please try again.",
    };
  }
}

export function buildShareText(payload: ReservationSharePayload): string {
  const venue = ensureVenue(payload);
  const startDate = normaliseDate(payload.startAt);
  const summaryDate = startDate
    ? formatReservationSummaryDate(startDate.toISOString().slice(0, 10), {
        timezone: venue.timezone,
      })
    : '';
  const summaryTime = startDate ? formatReservationTimeFromDate(startDate) : '';
  const party = payload.partySize ?? 1;
  const partyLabel = `${party} ${party === 1 ? "guest" : "guests"}`;

  return [
    `${venue.name} reservation`,
    `Reference: ${payload.reference ?? payload.reservationId}`,
    `When: ${summaryDate || "TBC"} at ${summaryTime || "TBC"}`,
    `Guests: ${partyLabel}`,
    `Venue: ${venue.address}`,
  ].join("\n");
}

export async function shareReservationDetails(
  payload: ReservationSharePayload,
): Promise<ShareResult> {
  const venue = ensureVenue(payload);
  const text = buildShareText(payload);

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${venue.name} reservation`,
        text,
      });
      return {
        variant: "success",
        message: "Sharing sheet opened. Follow the prompts to save your reservation.",
      };
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return {
        variant: "info",
        message: "Reservation details copied. Paste into any app to share.",
      };
    }

    return {
      variant: "info",
      message: text,
    };
  } catch (error) {
    console.error("[reservation-share] failed to share reservation", error);
    return {
      variant: "error",
      message: "We couldn't share the reservation details. Please try again.",
    };
  }
}
