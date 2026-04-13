import { DateTime } from 'luxon';

import { normalizePhone } from '@/server/customers';

import type { TwilioMessageRecord } from '@/lib/twilio/sms';

export type SmsBackfillBookingCandidate = {
  id: string;
  restaurantId: string;
  reference: string | null;
  customerPhone: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

export type SmsBackfillMatchedBy =
  | 'reference+phone'
  | 'phone+body+created_at'
  | 'phone+body+updated_at'
  | 'phone+created_at'
  | 'phone+updated_at';

export type SmsBackfillMatch =
  | {
      kind: 'matched';
      bookingId: string;
      restaurantId: string;
      bookingReference: string | null;
      smsType: string | null;
      matchedBy: SmsBackfillMatchedBy;
      occurredAt: string | null;
      normalizedRecipientPhone: string;
      messageSid: string;
      providerStatus: string | null;
    }
  | {
      kind: 'ambiguous';
      reason: string;
      candidateBookingIds: string[];
      normalizedRecipientPhone: string | null;
      messageSid: string;
    }
  | {
      kind: 'unmatched';
      reason: string;
      normalizedRecipientPhone: string | null;
      messageSid: string;
    };

type CandidateScore = {
  booking: SmsBackfillBookingCandidate;
  smsType: string | null;
  matchedBy: SmsBackfillMatchedBy;
  distanceMs: number;
  rank: number;
};

const CONFIRMATION_WINDOW_MS = 45 * 60 * 1000;
const UPDATE_WINDOW_MS = 90 * 60 * 1000;
const CANCELLATION_WINDOW_MS = 90 * 60 * 1000;
const UPDATED_AT_CONFIRMATION_SEPARATION_MS = 5 * 60 * 1000;

function safeNormalizePhone(value: string | null | undefined): string {
  try {
    return normalizePhone(value);
  } catch {
    return (value ?? '').replace(/[^0-9]/g, '');
  }
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const iso = DateTime.fromISO(value, { setZone: true });
  if (iso.isValid) {
    return iso.toMillis();
  }

  const rfc2822 = DateTime.fromRFC2822(value, { setZone: true });
  if (rfc2822.isValid) {
    return rfc2822.toMillis();
  }

  return null;
}

function canonicalizeReference(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function normalizeMessageBody(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function inferHistoricalSmsTypeFromBody(body: string | null | undefined): string | null {
  const normalized = normalizeMessageBody(body);
  if (!normalized) return null;

  if (normalized.includes('your booking is confirmed.')) {
    return 'booking_confirmation';
  }
  if (normalized.includes('your booking has been updated.')) {
    return 'booking_update';
  }
  if (normalized.includes('your booking has been cancelled by the restaurant.')) {
    return 'restaurant_cancellation';
  }
  if (normalized.includes('your booking has been cancelled.')) {
    return 'booking_cancellation';
  }

  return null;
}

export function extractBookingReferenceFromSmsBody(body: string | null | undefined): string | null {
  const raw = body ?? '';
  const match = raw.match(/reference:\s*([A-Z0-9-]+)/i);
  if (!match?.[1]) return null;
  return canonicalizeReference(match[1]);
}

function getMessageOccurredAt(message: TwilioMessageRecord): string | null {
  return message.dateSent ?? message.dateCreated ?? message.dateUpdated ?? null;
}

function buildReferenceMatch(
  message: TwilioMessageRecord,
  booking: SmsBackfillBookingCandidate,
  normalizedRecipientPhone: string,
): SmsBackfillMatch {
  return {
    kind: 'matched',
    bookingId: booking.id,
    restaurantId: booking.restaurantId,
    bookingReference: booking.reference,
    smsType: inferHistoricalSmsTypeFromBody(message.body),
    matchedBy: 'reference+phone',
    occurredAt: getMessageOccurredAt(message),
    normalizedRecipientPhone,
    messageSid: message.sid,
    providerStatus: message.status ?? null,
  };
}

function scoreTypedCandidate(
  messageMs: number,
  booking: SmsBackfillBookingCandidate,
  smsType: string,
): CandidateScore | null {
  const createdMs = parseMs(booking.createdAt);
  const updatedMs = parseMs(booking.updatedAt);

  switch (smsType) {
    case 'booking_confirmation': {
      if (createdMs === null) return null;
      const distanceMs = Math.abs(messageMs - createdMs);
      if (distanceMs > CONFIRMATION_WINDOW_MS) return null;
      return {
        booking,
        smsType,
        matchedBy: 'phone+body+created_at',
        distanceMs,
        rank: 0,
      };
    }
    case 'booking_update': {
      if (updatedMs === null) return null;
      const distanceMs = Math.abs(messageMs - updatedMs);
      if (distanceMs > UPDATE_WINDOW_MS) return null;
      return {
        booking,
        smsType,
        matchedBy: 'phone+body+updated_at',
        distanceMs,
        rank: 0,
      };
    }
    case 'booking_cancellation':
    case 'restaurant_cancellation': {
      if (booking.status !== 'cancelled' || updatedMs === null) return null;
      const distanceMs = Math.abs(messageMs - updatedMs);
      if (distanceMs > CANCELLATION_WINDOW_MS) return null;
      return {
        booking,
        smsType,
        matchedBy: 'phone+body+updated_at',
        distanceMs,
        rank: 0,
      };
    }
    default:
      return null;
  }
}

function scoreUntypedCandidate(
  messageMs: number,
  booking: SmsBackfillBookingCandidate,
): CandidateScore[] {
  const scored: CandidateScore[] = [];
  const createdMs = parseMs(booking.createdAt);
  const updatedMs = parseMs(booking.updatedAt);

  if (createdMs !== null) {
    const distanceMs = Math.abs(messageMs - createdMs);
    if (distanceMs <= CONFIRMATION_WINDOW_MS) {
      scored.push({
        booking,
        smsType: 'booking_confirmation',
        matchedBy: 'phone+created_at',
        distanceMs,
        rank: 1,
      });
    }
  }

  if (updatedMs !== null) {
    const updatedDistanceMs = Math.abs(messageMs - updatedMs);

    if (booking.status === 'cancelled' && updatedDistanceMs <= CANCELLATION_WINDOW_MS) {
      scored.push({
        booking,
        smsType: 'booking_cancellation',
        matchedBy: 'phone+updated_at',
        distanceMs: updatedDistanceMs,
        rank: 2,
      });
    } else if (
      updatedDistanceMs <= UPDATE_WINDOW_MS &&
      (createdMs === null || Math.abs(updatedMs - createdMs) > UPDATED_AT_CONFIRMATION_SEPARATION_MS)
    ) {
      scored.push({
        booking,
        smsType: 'booking_update',
        matchedBy: 'phone+updated_at',
        distanceMs: updatedDistanceMs,
        rank: 3,
      });
    }
  }

  return scored;
}

export function matchHistoricalTwilioMessageToBooking(
  message: TwilioMessageRecord,
  bookings: readonly SmsBackfillBookingCandidate[],
): SmsBackfillMatch {
  const normalizedRecipientPhone = safeNormalizePhone(message.to);
  if (!normalizedRecipientPhone) {
    return {
      kind: 'unmatched',
      reason: 'recipient_phone_unusable',
      normalizedRecipientPhone: null,
      messageSid: message.sid,
    };
  }

  const samePhoneBookings = bookings.filter(
    (booking) => safeNormalizePhone(booking.customerPhone) === normalizedRecipientPhone,
  );
  if (samePhoneBookings.length === 0) {
    return {
      kind: 'unmatched',
      reason: 'no_booking_for_phone',
      normalizedRecipientPhone,
      messageSid: message.sid,
    };
  }

  const extractedReference = extractBookingReferenceFromSmsBody(message.body);
  if (extractedReference) {
    const sameReferenceBookings = samePhoneBookings.filter(
      (booking) => canonicalizeReference(booking.reference) === extractedReference,
    );

    if (sameReferenceBookings.length === 1) {
      return buildReferenceMatch(message, sameReferenceBookings[0], normalizedRecipientPhone);
    }

    if (sameReferenceBookings.length > 1) {
      return {
        kind: 'ambiguous',
        reason: 'multiple_bookings_share_reference',
        candidateBookingIds: sameReferenceBookings.map((booking) => booking.id),
        normalizedRecipientPhone,
        messageSid: message.sid,
      };
    }
  }

  const messageMs = parseMs(getMessageOccurredAt(message));
  if (messageMs === null) {
    return {
      kind: 'unmatched',
      reason: 'message_time_unusable',
      normalizedRecipientPhone,
      messageSid: message.sid,
    };
  }

  const explicitType = inferHistoricalSmsTypeFromBody(message.body);
  const candidateScores = explicitType
    ? samePhoneBookings
        .map((booking) => scoreTypedCandidate(messageMs, booking, explicitType))
        .filter((score): score is CandidateScore => Boolean(score))
    : samePhoneBookings.flatMap((booking) => scoreUntypedCandidate(messageMs, booking));

  if (candidateScores.length === 0) {
    return {
      kind: 'unmatched',
      reason: explicitType ? 'no_booking_in_typed_window' : 'no_booking_in_time_window',
      normalizedRecipientPhone,
      messageSid: message.sid,
    };
  }

  candidateScores.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.distanceMs !== right.distanceMs) return left.distanceMs - right.distanceMs;
    return left.booking.id.localeCompare(right.booking.id);
  });

  const bestRank = candidateScores[0].rank;
  const bestRankScores = candidateScores.filter((score) => score.rank === bestRank);
  const bestRankBookingIds = Array.from(new Set(bestRankScores.map((score) => score.booking.id)));

  if (bestRankBookingIds.length !== 1) {
    return {
      kind: 'ambiguous',
      reason: 'multiple_bookings_in_best_match_window',
      candidateBookingIds: [...bestRankBookingIds].sort((left, right) => left.localeCompare(right)),
      normalizedRecipientPhone,
      messageSid: message.sid,
    };
  }

  const winner = bestRankScores[0];
  return {
    kind: 'matched',
    bookingId: winner.booking.id,
    restaurantId: winner.booking.restaurantId,
    bookingReference: winner.booking.reference,
    smsType: winner.smsType,
    matchedBy: winner.matchedBy,
    occurredAt: getMessageOccurredAt(message),
    normalizedRecipientPhone,
    messageSid: message.sid,
    providerStatus: message.status ?? null,
  };
}
