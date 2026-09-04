import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { env } from '@/lib/env';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8 * 1024;
const payloadSchema = z.object({
  eventId: z.string().uuid(),
  bookingId: z.string().uuid(),
  restaurantId: z.string().uuid(),
  channel: z.enum(['whatsapp', 'email']),
  occurredAt: z.iso.datetime({ offset: true }),
});

function secureEqual(left: string, right: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(left), digest(right));
}

function hasValidReviewLinkWebhookAuthorization(request: Request, expectedToken: string): boolean {
  const header = request.headers.get('authorization');
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  return Boolean(expectedToken && token && secureEqual(token, expectedToken));
}

export async function POST(request: Request): Promise<Response> {
  const expectedToken = env.cloudflare.bookingShortLinksInternalToken;
  if (!hasValidReviewLinkWebhookAuthorization(request, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { error } = await getServiceSupabaseClient().rpc('record_review_link_click_v1', {
    p_booking_id: parsed.data.bookingId,
    p_channel: parsed.data.channel,
    p_event_id: parsed.data.eventId,
    p_occurred_at: parsed.data.occurredAt,
    p_restaurant_id: parsed.data.restaurantId,
  });
  if (error) {
    return Response.json({ error: 'Tracking unavailable' }, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
