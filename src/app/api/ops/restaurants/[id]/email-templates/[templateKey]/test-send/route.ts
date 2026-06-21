import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import {
  restaurantEmailTemplateKeySchema,
  sendRestaurantEmailTemplateTestSchema,
  type SendRestaurantEmailTemplateTestResponse,
} from '@/app/api/ops/restaurants/schema';
import { sendRestaurantBookingEmailTest } from '@/server/emails/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import {
  ensureTemplateWriteAccess,
  resolveRestaurantId,
  resolveTemplateKeyParam,
  type RouteParams,
} from '../../_shared';

import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 400 });
  }

  const venueOrResponse = await ensureTemplateWriteAccess(restaurantId, req);
  if (venueOrResponse instanceof NextResponse) {
    return venueOrResponse;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'restaurant-email-template:test-send',
    tenantId: restaurantId,
    limit: 10,
    windowMs: 60_000,
    message: 'Too many test email requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedBody = sendRestaurantEmailTemplateTestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await sendRestaurantBookingEmailTest({
      venue: venueOrResponse,
      templateKey: parsedTemplateKey.data,
      toEmail: parsedBody.data.toEmail,
      draftVariants: parsedBody.data.variants,
      preferredVariantId: parsedBody.data.preferredVariantId,
    });

    const response: SendRestaurantEmailTemplateTestResponse = {
      ok: true,
      restaurantId,
      provider: result.provider,
      messageId: result.messageId,
      preview: {
        templateKey: result.preview.templateKey,
        selectedVariantId: result.preview.selectedVariantId,
        selectedVariantName: result.preview.selectedVariantName,
        preheader: result.preview.preheader,
        headline: result.preview.headline,
        intro: result.preview.intro,
        cue: result.preview.cue,
        ask: result.preview.ask,
        ctaLabel: result.preview.ctaLabel,
        ctaUrl: result.preview.ctaUrl,
        subject: result.preview.subject,
        html: result.preview.html,
        text: result.preview.text,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ops][restaurants][email-templates][test-send] failed', error);
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-template-test-send' },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send test email' },
      { status: 500 },
    );
  }
}
