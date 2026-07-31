import {
  buildRestaurantEmailTemplateVariantSignature,
  getUnknownRestaurantEmailTemplateTokens,
} from '@/lib/restaurants/email-templates';

import type {
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';

export type TemplateCopyField =
  | 'subject'
  | 'preheader'
  | 'headline'
  | 'intro'
  | 'cue'
  | 'ask'
  | 'ctaLabel';

export const TEMPLATE_FIELD_LIMITS: Record<TemplateCopyField, number> = {
  subject: 140,
  preheader: 180,
  headline: 140,
  intro: 280,
  cue: 180,
  ask: 180,
  ctaLabel: 60,
};

export const TEMPLATE_FIELD_LABELS: Record<TemplateCopyField, string> = {
  subject: 'Subject',
  preheader: 'Preheader',
  headline: 'Headline',
  intro: 'Message body',
  cue: 'Photo cue',
  ask: 'Review ask',
  ctaLabel: 'CTA label',
};

export type TemplateCopyFieldControl = 'input' | 'textarea';

export type TemplateCopyFieldSpec = {
  readonly className: string;
  readonly control: TemplateCopyFieldControl;
  readonly field: TemplateCopyField;
  readonly helpText?: string;
  readonly label: string;
  readonly showTargetHint?: boolean;
};

export type TemplateCopyFieldSection = {
  readonly fields: readonly TemplateCopyFieldSpec[];
  readonly layout: 'single' | 'two-column';
};

export type TemplateCopyCounterState = {
  readonly label: string;
  readonly length: number;
  readonly limit: number;
  readonly toneClassName: string;
};

export interface EmailTemplateVariantWarnings {
  readonly duplicateActiveVariantName: string | null;
  readonly unknownTokensByField: Record<TemplateCopyField, string[]>;
}

export function templateSupportsCueField(
  templateKey: RestaurantBookingEmailTemplateKey | null | undefined,
) {
  return templateKey === 'confirmation' || templateKey === 'reminder_24h';
}

export function templateSupportsAskField(
  templateKey: RestaurantBookingEmailTemplateKey | null | undefined,
) {
  return templateKey === 'review_request';
}

export function appendTemplateToken(currentValue: string, token: string) {
  return currentValue ? `${currentValue}${currentValue.endsWith(' ') ? '' : ' '}${token}` : token;
}

export function getCounterTone(length: number, limit: number) {
  const remaining = limit - length;
  if (remaining <= 10) return 'text-destructive';
  if (remaining <= 25) return 'text-primary';
  return 'text-muted-foreground';
}

export function getTemplateCopyFieldId(field: TemplateCopyField) {
  return `email-template-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export function buildTemplateCopyCounterState({
  field,
  value,
}: {
  readonly field: TemplateCopyField;
  readonly value: string;
}): TemplateCopyCounterState {
  const limit = TEMPLATE_FIELD_LIMITS[field];
  const length = value.length;

  return {
    label: `${length}/${limit}`,
    length,
    limit,
    toneClassName: getCounterTone(length, limit),
  };
}

export function formatUnknownTemplateTokens(tokens: ReadonlyArray<string>): string | null {
  if (tokens.length === 0) return null;
  return `Unknown variables: ${tokens.map((token) => `{{${token}}}`).join(', ')}`;
}

export function buildEmailTemplateCopyFieldSections({
  showAskField,
  showCueField,
  supportsCtaLabel,
}: {
  readonly showAskField: boolean;
  readonly showCueField: boolean;
  readonly supportsCtaLabel: boolean;
}): TemplateCopyFieldSection[] {
  const sections: TemplateCopyFieldSection[] = [
    {
      layout: 'two-column',
      fields: [
        {
          className: 'h-11 rounded-xl border-border text-sm font-medium',
          control: 'input',
          field: 'subject',
          helpText: 'Inbox subject line shown before the email opens.',
          label: 'Subject line',
        },
        {
          className: 'h-11 rounded-xl border-border',
          control: 'input',
          field: 'preheader',
          helpText: 'Preview text used by inbox clients and notifications.',
          label: 'Preheader',
        },
      ],
    },
    {
      layout: 'single',
      fields: [
        {
          className: 'h-11 rounded-xl border-border text-sm font-medium',
          control: 'input',
          field: 'headline',
          label: 'Hero headline',
        },
      ],
    },
    {
      layout: 'single',
      fields: [
        {
          className: 'min-h-[220px] rounded-2xl border-border text-sm leading-6',
          control: 'textarea',
          field: 'intro',
          label: 'Message body',
          showTargetHint: true,
        },
      ],
    },
  ];

  if (showCueField) {
    sections.push({
      layout: 'single',
      fields: [
        {
          className: 'min-h-[120px] rounded-2xl border-border text-sm leading-6',
          control: 'textarea',
          field: 'cue',
          helpText:
            'Gentle pre-visit priming only. Keep this secondary to the operational booking message.',
          label: 'Photo cue',
        },
      ],
    });
  }

  if (showAskField) {
    sections.push({
      layout: 'single',
      fields: [
        {
          className: 'min-h-[120px] rounded-2xl border-border text-sm leading-6',
          control: 'textarea',
          field: 'ask',
          helpText:
            'Optional extra line after the intro. Keep it light: avoid adding tasks before the review link.',
          label: 'Review ask',
        },
      ],
    });
  }

  if (supportsCtaLabel) {
    sections.push({
      layout: 'single',
      fields: [
        {
          className: 'h-11 max-w-sm rounded-xl border-border',
          control: 'input',
          field: 'ctaLabel',
          helpText: 'The destination URL stays system-controlled. Only the label changes here.',
          label: 'Call-to-action label',
        },
      ],
    });
  }

  return sections;
}

export function getEmailTemplateVariantWarnings({
  currentVariant,
  currentVariants,
}: {
  readonly currentVariant: RestaurantEmailTemplateVariant | null;
  readonly currentVariants: ReadonlyArray<RestaurantEmailTemplateVariant>;
}): EmailTemplateVariantWarnings {
  if (!currentVariant) {
    return {
      duplicateActiveVariantName: null,
      unknownTokensByField: {
        subject: [],
        preheader: [],
        headline: [],
        intro: [],
        cue: [],
        ask: [],
        ctaLabel: [],
      },
    };
  }

  const unknownTokensByField: Record<TemplateCopyField, string[]> = {
    subject: getUnknownRestaurantEmailTemplateTokens(currentVariant.subject),
    preheader: getUnknownRestaurantEmailTemplateTokens(currentVariant.preheader),
    headline: getUnknownRestaurantEmailTemplateTokens(currentVariant.headline),
    intro: getUnknownRestaurantEmailTemplateTokens(currentVariant.intro),
    cue: getUnknownRestaurantEmailTemplateTokens(currentVariant.cue),
    ask: getUnknownRestaurantEmailTemplateTokens(currentVariant.ask),
    ctaLabel: getUnknownRestaurantEmailTemplateTokens(currentVariant.ctaLabel),
  };

  const duplicateActiveVariantName = currentVariant.isActive
    ? (currentVariants.find(
        (variant) =>
          variant.id !== currentVariant.id &&
          variant.isActive &&
          buildRestaurantEmailTemplateVariantSignature(variant) ===
            buildRestaurantEmailTemplateVariantSignature(currentVariant),
      )?.name ?? null)
    : null;

  return { duplicateActiveVariantName, unknownTokensByField };
}
