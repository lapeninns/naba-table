import { describe, expect, it } from 'vitest';

import {
  buildNewVariant,
  copyFieldsFor,
  counterState,
  duplicateVariant,
  findDuplicateLiveVariant,
  insertToken,
  saveBlockers,
  variantProblems,
} from '@/components/features/email-templates/model/emailTemplateEditorModel';
import { getDefaultTemplateVariants } from '@/lib/restaurants/email-templates';

import type { RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';

function variant(overrides: Partial<RestaurantEmailTemplateVariant> = {}) {
  return { ...getDefaultTemplateVariants('confirmation')[0]!, ...overrides };
}

describe('copyFieldsFor', () => {
  it('adds the photo cue only where the email shows one', () => {
    expect(copyFieldsFor('confirmation')).toEqual([
      'subject',
      'preheader',
      'headline',
      'intro',
      'cue',
      'ctaLabel',
    ]);
    expect(copyFieldsFor('review_request')).toContain('ask');
    expect(copyFieldsFor('cancelled')).not.toContain('cue');
    expect(copyFieldsFor('cancelled')).not.toContain('ask');
  });
});

describe('variantProblems', () => {
  it('reports nothing for the default copy', () => {
    expect(variantProblems(variant(), 'confirmation')).toEqual({});
  });

  it('flags empty required fields, unknown variables and overlong text, as the server would', () => {
    const problems = variantProblems(
      variant({ subject: '   ', intro: 'Hi {{guest}}', ctaLabel: 'x'.repeat(61) }),
      'confirmation',
    );

    expect(problems.subject).toBe('Subject line is empty. Add text, or reset this variant.');
    expect(problems.intro).toMatch(/Unknown variable \{\{guest\}\}/);
    expect(problems.ctaLabel).toBe('Button label is 1 character over the 60 limit.');
  });

  it('ignores optional fields the email does not show', () => {
    expect(variantProblems(variant({ ask: '{{nope}}' }), 'confirmation')).toEqual({});
    expect(variantProblems(variant({ cue: '' }), 'confirmation')).toEqual({});
  });
});

describe('findDuplicateLiveVariant and saveBlockers', () => {
  const a = variant({ id: 'a', name: 'A', order: 0 });
  const b = variant({ id: 'b', name: 'B', order: 1 });

  it('finds another live variant with the same wording, ignoring case and spacing', () => {
    const twin = { ...b, headline: ` ${a.headline.toUpperCase()} ` };
    expect(findDuplicateLiveVariant([a, twin], a)?.id).toBe('b');
    expect(findDuplicateLiveVariant([a, { ...twin, isActive: false }], a)).toBeNull();
  });

  it('blocks saving with no live variant, identical live copy, or a field problem', () => {
    expect(saveBlockers([a, { ...b, subject: 'Different' }], 'confirmation')).toEqual([]);

    expect(
      saveBlockers(
        [
          { ...a, isActive: false },
          { ...b, isActive: false },
        ],
        'confirmation',
      ),
    ).toEqual([{ kind: 'no-live' }]);

    expect(saveBlockers([a, b], 'confirmation')).toEqual([
      { kind: 'duplicate', variantId: 'b', otherName: 'A' },
    ]);

    expect(saveBlockers([{ ...a, headline: '' }], 'confirmation')).toEqual([
      { kind: 'field', variantId: 'a', field: 'headline', message: expect.any(String) },
    ]);
  });
});

describe('counterState', () => {
  it('counts up, then counts down near the limit, then reports the overflow', () => {
    expect(counterState('ctaLabel', 'Manage booking')).toEqual({ text: '14 / 60', tone: 'normal' });
    expect(counterState('ctaLabel', 'x'.repeat(50))).toEqual({ text: '10 left', tone: 'low' });
    expect(counterState('ctaLabel', 'x'.repeat(63))).toEqual({ text: '3 over', tone: 'over' });
  });
});

describe('insertToken', () => {
  it('inserts at the caret with spaces only where the text needs them', () => {
    expect(insertToken('Hello', 5, 5, '{{venue}}')).toEqual({
      value: 'Hello {{venue}}',
      caret: 15,
    });
    expect(insertToken('Hello world', 6, 6, '{{venue}}')).toEqual({
      value: 'Hello {{venue}} world',
      caret: 15,
    });
    expect(insertToken('', 0, 0, '{{date}}')).toEqual({ value: '{{date}}', caret: 8 });
  });

  it('replaces the selected text', () => {
    expect(insertToken('See you at VENUE', 11, 16, '{{venue}}')).toEqual({
      value: 'See you at {{venue}}',
      caret: 20,
    });
  });
});

describe('new variants', () => {
  it('starts added variants paused from the first default, named by position', () => {
    const next = buildNewVariant('confirmation', [a(), a()], 'new-id');
    expect(next).toMatchObject({ id: 'new-id', name: 'Variant 3', isActive: false, order: 2 });
    expect(next.subject).toBe(getDefaultTemplateVariants('confirmation')[0]!.subject);
  });

  it('duplicates a variant paused so it does not send until set live', () => {
    const copy = duplicateVariant(variant({ name: 'Warm' }), 1, 'copy-id');
    expect(copy).toMatchObject({ id: 'copy-id', name: 'Warm copy', isActive: false, order: 1 });
  });

  function a() {
    return variant();
  }
});
