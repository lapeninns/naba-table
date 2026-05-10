import { NextResponse } from 'next/server';

import {
  previewRestaurantEmailTemplateSchema,
  restaurantEmailTemplateKeySchema,
  type RestaurantEmailTemplatePreviewResponse,
} from '@/app/api/ops/restaurants/schema';
import { renderRestaurantBookingEmailPreview } from '@/server/emails/bookings';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';

import {
  ensureTemplateReadAccess,
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

  const access = await ensureTemplateReadAccess(restaurantId);
  if (access instanceof NextResponse) {
    return access;
  }

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'ops-email-templates:preview',
    tenantId: restaurantId,
    limit: 30,
    windowMs: 60_000,
    message: 'Too many preview requests. Please try again later.',
  });
  if (rateLimit) {
    return rateLimit;
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsedBody = previewRestaurantEmailTemplateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const preview = renderRestaurantBookingEmailPreview({
      venue: access.venue,
      templateKey: parsedTemplateKey.data,
      draftVariants: parsedBody.data.variants,
      preferredVariantId: parsedBody.data.preferredVariantId,
    });

    const response: RestaurantEmailTemplatePreviewResponse = {
      restaurantId,
      preview: {
        templateKey: preview.templateKey,
        selectedVariantId: preview.selectedVariantId,
        selectedVariantName: preview.selectedVariantName,
        preheader: preview.preheader,
        headline: preview.headline,
        intro: preview.intro,
        cue: preview.cue,
        ask: preview.ask,
        ctaLabel: preview.ctaLabel,
        ctaUrl: preview.ctaUrl,
        subject: preview.subject,
        html: preview.html,
        text: preview.text,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error('[ops][restaurants][email-templates][preview] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to render preview' },
      { status: 500 },
    );
  }
}
