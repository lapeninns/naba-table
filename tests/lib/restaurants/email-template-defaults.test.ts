import { describe, expect, it, vi } from 'vitest';

import { TEMPLATE_DEFINITIONS } from '@/lib/restaurants/email-template-defaults';
import {
  BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS,
  RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS,
  RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS,
  getDefaultTemplateVariants,
  getUnknownRestaurantEmailTemplateTokens,
  interpolateRestaurantEmailTemplateText,
  pickDeterministicTemplateVariant,
  type BookingEmailTemplateVariableMap,
} from '@/lib/restaurants/email-templates';

const TEXT_FIELDS = [
  'subject',
  'preheader',
  'headline',
  'intro',
  'cue',
  'ask',
  'ctaLabel',
] as const;

const FULL_VARIABLES: BookingEmailTemplateVariableMap = {
  name: 'Aman Shrestha',
  firstName: 'Aman',
  venue: 'Old Crown',
  date: 'Friday 17 July',
  time: '19:30',
  party: '4 guests',
};

function extractTokens(text: string): string[] {
  return [...text.matchAll(/\{\{([\w]+)\}\}/g)].map((match) => match[1]!);
}

describe('restaurant email template defaults', () => {
  it('covers every booking email template key exactly once with a valid group @contract', () => {
    const keys = TEMPLATE_DEFINITIONS.map((definition) => definition.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS].sort());
    for (const definition of TEMPLATE_DEFINITIONS) {
      expect(RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS).toContain(definition.group);
    }
  });

  it('ships three complete default variants per family with globally unique ids @contract', () => {
    const seenIds = new Set<string>();

    for (const definition of TEMPLATE_DEFINITIONS) {
      expect(definition.defaultVariants).toHaveLength(3);
      for (const [index, variant] of definition.defaultVariants.entries()) {
        expect(seenIds.has(variant.id)).toBe(false);
        seenIds.add(variant.id);
        expect(variant.id).toBe(`${definition.key.replaceAll('_', '-')}-default-${index + 1}`);
        expect(variant.name.trim().length).toBeGreaterThan(0);
        expect(variant.subject.trim().length).toBeGreaterThan(0);
        expect(variant.preheader.trim().length).toBeGreaterThan(0);
        expect(variant.headline.trim().length).toBeGreaterThan(0);
        expect(variant.intro.trim().length).toBeGreaterThan(0);
        if (definition.supportsCtaLabel) {
          expect(variant.ctaLabel.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('only uses placeholders from each family recommended variables and the global variable map @contract', () => {
    const globalKeys = new Set<string>(BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS);

    for (const definition of TEMPLATE_DEFINITIONS) {
      const recommended = new Set<string>(definition.recommendedVariables);
      for (const variableKey of definition.recommendedVariables) {
        expect(globalKeys.has(variableKey)).toBe(true);
      }
      for (const variant of definition.defaultVariants) {
        for (const field of TEXT_FIELDS) {
          const text = variant[field];
          expect(getUnknownRestaurantEmailTemplateTokens(text)).toEqual([]);
          for (const token of extractTokens(text)) {
            expect(recommended.has(token), `${variant.id}.${field} uses {{${token}}}`).toBe(true);
          }
        }
      }
    }
  });

  it('review request defaults carry no photo ask and lead with the guest experience @contract', () => {
    const family = TEMPLATE_DEFINITIONS.find((definition) => definition.key === 'review_request');
    expect(family).toBeDefined();
    expect(family!.recommendedVariables).toEqual(
      expect.arrayContaining(['firstName', 'venue', 'date', 'party']),
    );
    for (const variant of family!.defaultVariants) {
      expect(variant.ask.trim()).toBe('');
      expect(variant.cue.trim()).toBe('');
      for (const field of ['subject', 'preheader', 'headline', 'intro', 'cue', 'ask'] as const) {
        expect(variant[field].toLowerCase()).not.toContain('photo');
      }
      expect(variant.subject).toMatch(/how (was|did)/i);
    }
  });

  it('renders every template family with defaults leaving no unresolved tokens @contract', () => {
    for (const key of RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS) {
      const variants = getDefaultTemplateVariants(key);
      expect(variants.length).toBeGreaterThan(0);
      for (const variant of variants) {
        for (const field of TEXT_FIELDS) {
          const rendered = interpolateRestaurantEmailTemplateText(variant[field], FULL_VARIABLES);
          expect(rendered).not.toMatch(/\{\{|\}\}/);
          if (variant[field].includes('{{venue}}')) {
            expect(rendered).toContain('Old Crown');
          }
        }
        expect(
          interpolateRestaurantEmailTemplateText(variant.subject, FULL_VARIABLES).trim().length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('substitutes missing variables with empty strings instead of leaking tokens @contract', () => {
    const missingVenue: BookingEmailTemplateVariableMap = { ...FULL_VARIABLES, venue: '' };

    for (const definition of TEMPLATE_DEFINITIONS) {
      for (const variant of definition.defaultVariants) {
        const subject = interpolateRestaurantEmailTemplateText(variant.subject, missingVenue);
        const intro = interpolateRestaurantEmailTemplateText(variant.intro, missingVenue);
        for (const rendered of [subject, intro]) {
          expect(rendered).not.toMatch(/\{\{|\}\}/);
          expect(rendered).not.toContain('undefined');
          expect(rendered).not.toContain('null');
        }
      }
    }
  });

  it('inserts special characters verbatim without HTML escaping or replacement-pattern expansion @contract', () => {
    const spicy: BookingEmailTemplateVariableMap = {
      ...FULL_VARIABLES,
      venue: 'Rossi & Sons <"Café">',
      party: '$& friends',
    };

    const rendered = interpolateRestaurantEmailTemplateText(
      'Your table for {{party}} at {{venue}} is confirmed',
      spicy,
    );

    // Interpolation is plain text substitution; HTML escaping is the renderer's
    // responsibility downstream. `$&` must not be expanded as a replacement pattern.
    expect(rendered).toBe('Your table for $& friends at Rossi & Sons <"Café"> is confirmed');
  });

  it('replaces unknown tokens with empty strings @contract', () => {
    expect(
      interpolateRestaurantEmailTemplateText('Hello {{mystery}} at {{venue}}', FULL_VARIABLES),
    ).toBe('Hello  at Old Crown');
  });

  it('keeps defaults stable across module reloads with no wall-clock or random content @contract', async () => {
    vi.resetModules();
    const freshImport = await import('@/lib/restaurants/email-template-defaults');

    expect(freshImport.TEMPLATE_DEFINITIONS).toEqual(TEMPLATE_DEFINITIONS);
    expect(JSON.stringify(freshImport.TEMPLATE_DEFINITIONS)).toBe(
      JSON.stringify(TEMPLATE_DEFINITIONS),
    );
    for (const definition of TEMPLATE_DEFINITIONS) {
      for (const variant of definition.defaultVariants) {
        for (const field of TEXT_FIELDS) {
          expect(typeof variant[field]).toBe('string');
        }
      }
    }
  });

  it('exposes defaults as active, index-ordered, mutation-isolated variants @contract', () => {
    const first = getDefaultTemplateVariants('confirmation');
    expect(first.map((variant) => variant.order)).toEqual([0, 1, 2]);
    expect(first.every((variant) => variant.isActive)).toBe(true);

    first[0]!.subject = 'MUTATED';
    const second = getDefaultTemplateVariants('confirmation');
    expect(second[0]!.subject).not.toBe('MUTATED');
    expect(TEMPLATE_DEFINITIONS.find((definition) => definition.key === 'confirmation')!
      .defaultVariants[0]!.subject).not.toBe('MUTATED');
  });

  it('picks the same default variant for the same deterministic seed under any host clock @contract', () => {
    for (const key of RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS) {
      const variants = getDefaultTemplateVariants(key);
      const seed = `booking-42|${key}|guest@example.com`;
      const firstPick = pickDeterministicTemplateVariant(variants, seed);
      const secondPick = pickDeterministicTemplateVariant(getDefaultTemplateVariants(key), seed);

      expect(firstPick.id).toBe(secondPick.id);
    }
  });
});
