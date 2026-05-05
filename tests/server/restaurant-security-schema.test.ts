import { describe, expect, it } from 'vitest';

import {
  createRestaurantSchema,
  updateRestaurantEmailTemplateSchema,
  updateRestaurantSchema,
} from '@/src/app/api/ops/restaurants/schema';

describe('restaurant security schemas', () => {
  it('rejects unsafe URL schemes at restaurant write boundaries', () => {
    expect(
      createRestaurantSchema.safeParse({
        name: 'Demo',
        timezone: 'Europe/London',
        googleMapUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);

    expect(
      updateRestaurantSchema.safeParse({
        googleReviewUrl: 'data:text/html,<script>alert(1)</script>',
      }).success,
    ).toBe(false);
  });

  it('canonicalizes accepted Google URLs', () => {
    const parsed = updateRestaurantSchema.parse({
      googleMapUrl: ' HTTPS://MAPS.GOOGLE.COM/?q=Demo ',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=abc',
    });

    expect(parsed.googleMapUrl).toBe('https://maps.google.com/?q=Demo');
    expect(parsed.googleReviewUrl).toBe('https://search.google.com/local/writereview?placeid=abc');
  });

  it('rejects script delimiters in plain text email template fields', () => {
    const result = updateRestaurantEmailTemplateSchema.safeParse({
      variants: [
        {
          id: 'variant-1',
          name: 'Variant',
          subject: 'Thanks',
          preheader: 'Preview',
          headline: 'Hello',
          intro: 'Safe intro',
          cue: '',
          ask: '',
          ctaLabel: '</script><script>alert(1)</script>',
          isActive: true,
          order: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
