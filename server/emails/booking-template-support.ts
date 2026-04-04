import { randomUUID } from 'node:crypto';

import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';
import type { VenueDetails } from '@/lib/venue';
import type { BookingRecord } from '@/server/bookings';

export function buildBookingTemplateTestIdempotencyParts(params: {
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail: string;
}): [string, string, string] {
  return [params.templateKey, params.recipientEmail.toLowerCase(), randomUUID()];
}

export function renderBookingEmailText(params: {
  booking: BookingRecord;
  venue: VenueDetails;
  summary: {
    date: string;
    startTime: string;
    party: string;
  };
  headline: string;
  intro: string;
  cue?: string;
  ask?: string;
  actionLabel?: string;
  actionUrl?: string;
}): string {
  const resolvedActionLabel = params.actionLabel?.trim() || 'Manage your booking';
  const resolvedActionUrl = params.actionUrl?.trim();

  return `
${params.headline.toUpperCase()}
${'-'.repeat(params.headline.length)}

${params.intro}

${params.cue?.trim() ? `PHOTO CUE:\n${params.cue}\n` : ''}${params.ask?.trim() ? `REVIEW ASK:\n${params.ask}\n` : ''}

DETAILS:
Date: ${params.summary.date}
Time: ${params.summary.startTime}
Guests: ${params.summary.party}
Reference: ${params.booking.reference || params.booking.id}

VENUE:
${params.venue.name}
${params.venue.address}
${params.venue.phone}

${resolvedActionUrl ? `${resolvedActionLabel}: ${resolvedActionUrl}` : ''}
  `.trim();
}
