import { formatBookingTime, getGuestInitials, parseBookingDateTime } from './utils';

import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';

export type GuestProfileFacts = {
  formattedStartTime: string;
  durationMinutes: number | null;
  whatsappHref: string | null;
  sourceLabel: string;
  occasionLabel: string;
  depositLabel: string | null;
  initials: string;
  isLate: boolean;
  hasDietary: boolean;
  showCountdown: boolean;
  hasNotes: boolean;
};

export function formatDepositGBP(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(parsed);
  }
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

export function resolveGuestProfileFacts({
  booking,
  bookingDate,
  timezone,
  status,
  minutesRemaining,
}: {
  booking: OpsTodayBooking;
  bookingDate: string | null;
  timezone: string;
  status: OpsBookingStatus;
  minutesRemaining: number | null;
}): GuestProfileFacts {
  const formattedStartTime = formatBookingTime(booking.startTime, bookingDate, timezone);
  const durationMinutes = resolveDurationMinutes({ booking, bookingDate, timezone });
  const digits = booking.customerPhone ? booking.customerPhone.replace(/[^0-9]/g, '') : '';
  const occasionLabel =
    booking.details && typeof booking.details['occasion'] === 'string'
      ? String(booking.details['occasion'])
      : 'Standard';
  const depositRaw =
    booking.details?.['deposit'] ??
    booking.details?.['depositAmount'] ??
    booking.details?.['prepay'] ??
    booking.details?.['prepayAmount'] ??
    booking.details?.['prepaidAmount'];

  return {
    formattedStartTime,
    durationMinutes,
    whatsappHref: digits ? `https://wa.me/${digits}` : null,
    sourceLabel: booking.source ?? 'Direct',
    occasionLabel,
    depositLabel: formatDepositGBP(depositRaw),
    initials: getGuestInitials(booking.customerName),
    isLate: status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0,
    hasDietary:
      Boolean(booking.allergies && booking.allergies.length > 0) ||
      Boolean(booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0),
    showCountdown:
      minutesRemaining !== null &&
      minutesRemaining > -120 &&
      !['completed', 'cancelled', 'no_show', 'checked_in'].includes(status),
    hasNotes: Boolean(booking.notes) || Boolean(booking.profileNotes),
  };
}

function resolveDurationMinutes({
  booking,
  bookingDate,
  timezone,
}: {
  booking: OpsTodayBooking;
  bookingDate: string | null;
  timezone: string;
}): number | null {
  if (!bookingDate) return null;
  const start = parseBookingDateTime({ time: booking.startTime, date: bookingDate, timezone });
  const end = parseBookingDateTime({ time: booking.endTime, date: bookingDate, timezone });
  if (!start || !end) return null;
  const minutes = Math.max(0, Math.round(end.diff(start, 'minutes').minutes ?? 0));
  return Number.isFinite(minutes) ? minutes : null;
}
