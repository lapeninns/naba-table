import { describe, expect, it } from 'vitest';

import {
  buildEmailTemplateCopyFieldSections,
  buildTemplateCopyCounterState,
  formatUnknownTemplateTokens,
  getTemplateCopyFieldId,
} from '@/components/features/email-templates/emailTemplatesEditorDomain';

describe('emailTemplatesEditorDomain copy fields', () => {
  it('builds base copy field sections in the renderer order', () => {
    const sections = buildEmailTemplateCopyFieldSections({
      showAskField: false,
      showCueField: false,
      supportsCtaLabel: false,
    });

    expect(sections.map((section) => section.fields.map((field) => field.field))).toEqual([
      ['subject', 'preheader'],
      ['headline'],
      ['intro'],
    ]);
    expect(sections[0]?.layout).toBe('two-column');
    expect(sections[2]?.fields[0]).toMatchObject({
      control: 'textarea',
      field: 'intro',
      label: 'Message body',
      showTargetHint: true,
    });
  });

  it('adds optional cue, ask, and CTA sections only when supported', () => {
    const fields = buildEmailTemplateCopyFieldSections({
      showAskField: true,
      showCueField: true,
      supportsCtaLabel: true,
    }).flatMap((section) => section.fields.map((field) => field.field));

    expect(fields).toEqual(['subject', 'preheader', 'headline', 'intro', 'cue', 'ask', 'ctaLabel']);
  });

  it('derives stable copy field ids', () => {
    expect(getTemplateCopyFieldId('subject')).toBe('email-template-subject');
    expect(getTemplateCopyFieldId('ctaLabel')).toBe('email-template-cta-label');
  });

  it('builds counter state with matching tone thresholds', () => {
    expect(buildTemplateCopyCounterState({ field: 'subject', value: 'Short' })).toEqual({
      label: '5/140',
      length: 5,
      limit: 140,
      toneClassName: 'text-muted-foreground',
    });
    expect(
      buildTemplateCopyCounterState({ field: 'ctaLabel', value: 'x'.repeat(45) }).toneClassName,
    ).toBe('text-primary');
    expect(
      buildTemplateCopyCounterState({ field: 'ctaLabel', value: 'x'.repeat(55) }).toneClassName,
    ).toBe('text-destructive');
  });

  it('formats unknown token warnings for field help text', () => {
    expect(formatUnknownTemplateTokens([])).toBeNull();
    expect(formatUnknownTemplateTokens(['guest_name', 'booking_time'])).toBe(
      'Unknown variables: {{guest_name}}, {{booking_time}}',
    );
  });
});
