import { describe, expect, it } from 'vitest';

import {
  getUnknownRestaurantEmailTemplateTokens,
  getActiveTemplateVariants,
  getDefaultTemplateVariants,
  getEffectiveTemplateVariants,
  normalizeRestaurantEmailTemplatesDocument,
  pickDeterministicTemplateVariant,
} from '@/lib/restaurants/email-templates';

describe('restaurant email template catalog', () => {
  it('migrates the legacy created override onto request and confirmation templates', () => {
    const document = normalizeRestaurantEmailTemplatesDocument({
      created: {
        headline: 'Legacy headline',
        intro: 'Legacy intro',
      },
    });

    expect(document?.templates.request_received?.variants[0]).toMatchObject({
      headline: 'Legacy headline',
      intro: 'Legacy intro',
    });
    expect(document?.templates.confirmation?.variants[0]).toMatchObject({
      headline: 'Legacy headline',
      intro: 'Legacy intro',
    });
  });

  it('falls back to system defaults when a custom override has no active variants', () => {
    const document = normalizeRestaurantEmailTemplatesDocument({
      version: 1,
      templates: {
        confirmation: {
          variants: [
            {
              id: 'custom-1',
              name: 'Inactive custom',
              subject: 'Custom headline - {{venue}}',
              preheader: 'Custom intro',
              headline: 'Custom headline',
              intro: 'Custom intro',
              ctaLabel: 'Custom CTA',
              isActive: false,
              order: 0,
            },
          ],
        },
      },
    });

    const effective = getEffectiveTemplateVariants('confirmation', document);

    expect(effective.source).toBe('default');
    expect(effective.variants[0]?.headline).not.toBe('Custom headline');
  });

  it('picks deterministically from active variants only', () => {
    const variants = [
      {
        id: 'a',
        name: 'A',
        subject: 'A - {{venue}}',
        preheader: 'A',
        headline: 'A',
        intro: 'A',
        ctaLabel: 'A',
        isActive: true,
        order: 0,
      },
      {
        id: 'b',
        name: 'B',
        subject: 'B - {{venue}}',
        preheader: 'B',
        headline: 'B',
        intro: 'B',
        ctaLabel: 'B',
        isActive: false,
        order: 1,
      },
      {
        id: 'c',
        name: 'C',
        subject: 'C - {{venue}}',
        preheader: 'C',
        headline: 'C',
        intro: 'C',
        ctaLabel: 'C',
        isActive: true,
        order: 2,
      },
    ];

    const activeVariants = getActiveTemplateVariants(variants);
    const first = pickDeterministicTemplateVariant(variants, 'booking-123|confirmation|alice@example.com');
    const second = pickDeterministicTemplateVariant(variants, 'booking-123|confirmation|alice@example.com');

    expect(activeVariants.map((variant) => variant.id)).toEqual(['a', 'c']);
    expect(first.id).toBe(second.id);
    expect(['a', 'c']).toContain(first.id);
    expect(first.id).not.toBe('b');
  });

  it('uses the real hardcoded booking confirmation copy as the default variants', () => {
    const confirmation = getDefaultTemplateVariants('confirmation');

    expect(confirmation.map((variant) => variant.subject)).toEqual([
      'Booking Confirmed 🎉 - {{venue}}',
      "You're In! 🥂 - {{venue}}",
      'Table Secured 🍽️ - {{venue}}',
    ]);
    expect(confirmation.map((variant) => variant.preheader)).toEqual([
      "Great news, {{firstName}}! Your table at {{venue}} is secured. We've added this to your upcoming bookings.",
      "{{firstName}}, your reservation at {{venue}} is confirmed. We can't wait to host you!",
      "All set, {{firstName}}. We've reserved a spot for you at {{venue}}. See you soon!",
    ]);
    expect(confirmation.map((variant) => variant.headline)).toEqual([
      'Booking Confirmed 🎉',
      "You're In! 🥂",
      'Table Secured 🍽️',
    ]);
    expect(confirmation.map((variant) => variant.ctaLabel)).toEqual([
      'Manage Booking',
      'Manage Booking',
      'Manage Booking',
    ]);
  });

  it('flags unknown template variables without rejecting supported ones', () => {
    expect(getUnknownRestaurantEmailTemplateTokens('Hi {{firstName}}, see you at {{venue}}')).toEqual([]);
    expect(getUnknownRestaurantEmailTemplateTokens('Hi {{guestName}}, see you at {{venue}}')).toEqual(['guestName']);
  });
});
