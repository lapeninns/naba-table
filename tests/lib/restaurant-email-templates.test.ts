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
              cue: '',
              ask: '',
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
        cue: '',
        ask: '',
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
        cue: '',
        ask: '',
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
        cue: '',
        ask: '',
        ctaLabel: 'C',
        isActive: true,
        order: 2,
      },
    ];

    const activeVariants = getActiveTemplateVariants(variants);
    const first = pickDeterministicTemplateVariant(
      variants,
      'booking-123|confirmation|alice@example.com',
    );
    const second = pickDeterministicTemplateVariant(
      variants,
      'booking-123|confirmation|alice@example.com',
    );

    expect(activeVariants.map((variant) => variant.id)).toEqual(['a', 'c']);
    expect(first.id).toBe(second.id);
    expect(['a', 'c']).toContain(first.id);
    expect(first.id).not.toBe('b');
  });

  it('uses the configured booking confirmation catalog copy as the default variants', () => {
    const confirmation = getDefaultTemplateVariants('confirmation');

    expect(confirmation.map((variant) => variant.subject)).toEqual([
      'Your table at {{venue}} is confirmed',
      'Confirmed: {{venue}} on {{date}}',
      'See you soon at {{venue}}',
    ]);
    expect(confirmation.map((variant) => variant.preheader)).toEqual([
      '{{date}} at {{time}} for {{party}} is secured.',
      'Everything is set for {{time}}.',
      'Your reservation details are ready to go.',
    ]);
    expect(confirmation.map((variant) => variant.headline)).toEqual([
      'Your reservation is confirmed',
      'You are all set',
      'Table secured',
    ]);
    expect(confirmation.map((variant) => variant.ctaLabel)).toEqual([
      'Manage Booking',
      'Manage Booking',
      'Manage Booking',
    ]);
    expect(confirmation.map((variant) => variant.cue)).toEqual(['', '', '']);
  });

  it('does not prime guests for reviews in confirmation or reminder messages', () => {
    const preVisitCopy = [
      ...getDefaultTemplateVariants('confirmation'),
      ...getDefaultTemplateVariants('reminder_24h'),
      ...getDefaultTemplateVariants('reminder_short'),
    ]
      .flatMap((variant) => [variant.intro, variant.cue, variant.ask])
      .join(' ');

    expect(preVisitCopy).not.toMatch(/review|photo|feedback/i);
  });

  it('flags unknown template variables without rejecting supported ones', () => {
    expect(
      getUnknownRestaurantEmailTemplateTokens('Hi {{firstName}}, see you at {{venue}}'),
    ).toEqual([]);
    expect(
      getUnknownRestaurantEmailTemplateTokens('Hi {{guestName}}, see you at {{venue}}'),
    ).toEqual(['guestName']);
  });
});
