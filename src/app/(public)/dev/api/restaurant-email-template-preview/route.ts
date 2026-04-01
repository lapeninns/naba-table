import { NextResponse } from 'next/server';
import { z } from 'zod';

import { renderRestaurantBookingEmailPreview } from '@/server/emails/bookings';

import { enforceDevOnly } from '../../_shared/enforceDevOnly';

import type { RestaurantEmailTemplatePreviewResponse } from '@/app/api/ops/restaurants/schema';
import type { VenueDetails } from '@/lib/venue';
import type { NextRequest } from 'next/server';

const previewVenueSchema = z.object({
  id: z.string().min(1),
  slug: z.string().nullable(),
  name: z.string().min(1),
  timezone: z.string().min(1),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  policy: z.string().nullable(),
  logoUrl: z.string().nullable(),
  googleMapUrl: z.string().nullable(),
  googleReviewUrl: z.string().nullable(),
});

const previewVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  headline: z.string().min(1),
  intro: z.string().min(1),
  ctaLabel: z.string().min(1),
  isActive: z.boolean(),
  order: z.number().int().min(0),
});

const previewRequestSchema = z.object({
  templateKey: z.enum([
    'request_received',
    'confirmation',
    'modification_pending',
    'modification_confirmed',
    'cancelled',
    'booking_rejected',
    'restaurant_cancellation',
    'review_request',
    'reminder_24h',
    'reminder_short',
  ]),
  preferredVariantId: z.string().min(1).optional(),
  recipientEmail: z.string().email().optional(),
  variants: z.array(previewVariantSchema).max(5).optional(),
  venue: previewVenueSchema,
});

function toVenueDetails(
  venue: z.infer<typeof previewVenueSchema>,
): VenueDetails {
  return {
    id: venue.id,
    slug: venue.slug ?? '',
    name: venue.name,
    timezone: venue.timezone,
    address: venue.address ?? '',
    phone: venue.phone ?? '',
    email: venue.email ?? '',
    policy: venue.policy ?? '',
    logoUrl: venue.logoUrl,
    googleMapUrl: venue.googleMapUrl,
    googleReviewUrl: venue.googleReviewUrl,
    emailTemplates: null,
  };
}

export async function POST(req: NextRequest) {
  enforceDevOnly();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = previewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const preview = renderRestaurantBookingEmailPreview({
      venue: toVenueDetails(parsed.data.venue),
      templateKey: parsed.data.templateKey,
      draftVariants: parsed.data.variants,
      preferredVariantId: parsed.data.preferredVariantId,
      recipientEmail: parsed.data.recipientEmail,
    });

    const response: RestaurantEmailTemplatePreviewResponse = {
      restaurantId: parsed.data.venue.id,
      preview: {
        templateKey: preview.templateKey,
        selectedVariantId: preview.selectedVariantId,
        headline: preview.headline,
        intro: preview.intro,
        ctaLabel: preview.ctaLabel,
        ctaUrl: preview.ctaUrl,
        subject: preview.subject,
        html: preview.html,
        text: preview.text,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[dev][restaurant-email-template-preview] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to render preview' },
      { status: 500 },
    );
  }
}
