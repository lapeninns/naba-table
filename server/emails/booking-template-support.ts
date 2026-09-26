import { randomUUID } from 'node:crypto';

import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';
import type { VenueDetails } from '@/lib/venue';
import type { BookingRecord } from '@/server/bookings';

/**
 * Provider idempotency parts for a template test send. `requestKey` is the client's per-click
 * key (the Idempotency-Key header), stable across retries of the same click, so a retried request
 * is deduplicated by the provider while a new click sends again. Without one, every call is unique.
 * The restaurant id scopes the client-controlled key to one tenant (provider keys are
 * account-wide); the parts are hashed into the key, so none of them is ever truncated away.
 */
export function buildBookingTemplateTestIdempotencyParts(params: {
  restaurantId: string;
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail: string;
  requestKey?: string | null;
}): [string, string, string, string] {
  const requestKey = params.requestKey?.trim();
  return [
    params.restaurantId,
    params.templateKey,
    params.recipientEmail.toLowerCase(),
    requestKey || randomUUID(),
  ];
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
