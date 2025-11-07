#!/usr/bin/env tsx
/*
 * Render a booking email (HTML only) to stdout or a file for previewing.
 * Usage:
 *   pnpm tsx -r tsconfig-paths/register scripts/preview-booking-email.ts --id <booking-uuid> [--out preview.html]
 */

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local', override: true });

import { renderBookingEmailHtml } from '@/server/emails/bookings';
import { getServiceSupabaseClient } from '@/server/supabase';
import { formatDateForInput, formatReservationDateShort, formatReservationTime, formatReservationTimeFromDate } from '@reserve/shared/formatting/booking';
import { normalizeTime } from '@reserve/shared/time';

import type { VenueDetails } from '@/lib/venue';

function normalizeTimeLoose(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const normalized = normalizeTime(trimmed);
  if (normalized) return normalized;
  if (trimmed.length >= 5) return normalizeTime(trimmed.slice(0, 5));
  return null;
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildSummary(booking: any, venue: VenueDetails) {
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

function parseArgs(): { id: string; out?: string } {
  const idFlagIndex = process.argv.findIndex((v) => v === '--id');
  if (idFlagIndex === -1 || !process.argv[idFlagIndex + 1]) {
    console.error('Usage: scripts/preview-booking-email.ts --id <booking-uuid> [--out preview.html]');
    process.exit(1);
  }
  const outIdx = process.argv.findIndex((v) => v === '--out');
  const id = process.argv[idFlagIndex + 1];
  const out = outIdx !== -1 ? process.argv[outIdx + 1] : undefined;
  return { id, out };
}

async function resolveVenueDetails(restaurantId: string): Promise<VenueDetails> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id,name,timezone,contact_email,contact_phone,address,booking_policy')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error || !data) throw new Error('Restaurant not found or DB error');
  return {
    id: data.id,
    name: data.name || 'Restaurant',
    timezone: data.timezone || 'Europe/London',
    address: data.address || '',
    phone: data.contact_phone || '',
    email: data.contact_email || '',
    policy: data.booking_policy || '',
  };
}

async function main() {
  const { id, out } = parseArgs();
  const supabase = getServiceSupabaseClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error || !booking) throw new Error('Booking not found');
  const venue = await resolveVenueDetails(booking.restaurant_id);
  const summary = buildSummary(booking, venue);

  const guestFirstName = booking.customer_name.split(/\s+/)[0] || booking.customer_name;
  const isPending = booking.status === 'pending' || booking.status === 'pending_allocation';
  let headline = '';
  let intro = '';
  if (isPending) {
    headline = `${guestFirstName}, your reservation request`;
    intro = `We're lining up a table for ${summary.date} at ${summary.startTime}. Keep this ticket handy – it will update as soon as your reservation is confirmed.`;
  } else {
    headline = `${guestFirstName}, your reservation ticket`;
    intro = `Thanks for reserving a table at ${venue.name}. We'll be ready for you on ${summary.date} at ${summary.startTime}.`;
  }

  const html = renderBookingEmailHtml({
    booking,
    venue,
    summary,
    headline,
    intro,
    ctaLabel: 'View booking',
    ctaUrl: new URLSearchParams({ view: 'manage', email: booking.customer_email ?? '' }).toString() ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?view=manage&email=${encodeURIComponent(booking.customer_email || '')}` : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
    calendarActionUrl: undefined,
    walletActionUrl: undefined,
  } as any);

  if (out) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(out, html, 'utf8');
    console.log(`Wrote ${out}`);
  } else {
    console.log(html);
  }
}

main().catch((e) => {
  console.error('[preview-booking-email] error', e);
  process.exit(1);
});
