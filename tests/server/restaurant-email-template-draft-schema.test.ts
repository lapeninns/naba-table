import { describe, expect, it } from 'vitest';

import {
  previewRestaurantEmailTemplateSchema,
  sendRestaurantEmailTemplateTestSchema,
  updateRestaurantEmailTemplateSchema,
} from '@/src/app/api/ops/restaurants/schema';

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    name: 'Warm',
    subject: 'Your table at {{venue}}',
    preheader: 'See you soon',
    headline: 'Booked',
    intro: 'See you on {{date}}.',
    cue: '',
    ask: '',
    ctaLabel: 'Manage booking',
    isActive: true,
    order: 0,
    ...overrides,
  };
}

describe('email template draft schemas', () => {
  it('previews drafts that are still being written', () => {
    const halfWritten = [
      variant({ headline: '', intro: 'Hi {{guest}}', isActive: false }),
      variant({ id: 'v2', order: 1, isActive: false }),
    ];

    expect(previewRestaurantEmailTemplateSchema.safeParse({ variants: halfWritten }).success).toBe(
      true,
    );
    // Saving the same draft is refused.
    expect(updateRestaurantEmailTemplateSchema.safeParse({ variants: halfWritten }).success).toBe(
      false,
    );
  });

  it('still refuses markup, overlong text and malformed drafts in previews', () => {
    for (const bad of [
      [variant({ intro: '<script>alert(1)</script>' })],
      [variant({ subject: 'x'.repeat(141) })],
      [variant(), variant()],
      [],
    ]) {
      expect(previewRestaurantEmailTemplateSchema.safeParse({ variants: bad }).success).toBe(false);
    }
  });

  it('sends a test of a paused variant, but not of broken copy', () => {
    const paused = [variant({ isActive: false }), variant({ id: 'v2', order: 1, isActive: false })];
    expect(
      sendRestaurantEmailTemplateTestSchema.safeParse({
        toEmail: 'owner@example.com',
        preferredVariantId: 'v1',
        variants: paused,
      }).success,
    ).toBe(true);

    for (const broken of [variant({ subject: 'Hi {{guest}}' }), variant({ headline: ' ' })]) {
      expect(
        sendRestaurantEmailTemplateTestSchema.safeParse({
          toEmail: 'owner@example.com',
          variants: [broken],
        }).success,
      ).toBe(false);
    }
  });
});
