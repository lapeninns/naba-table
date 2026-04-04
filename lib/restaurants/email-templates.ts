import { TEMPLATE_DEFINITIONS } from '@/lib/restaurants/email-template-defaults';

export const RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS = [
  'request',
  'confirmation',
  'changes',
  'cancellation',
  'reminder',
  'review',
] as const;

export type RestaurantBookingEmailTemplateGroupKey =
  (typeof RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUP_KEYS)[number];

type TemplateGroupDefinition = {
  key: RestaurantBookingEmailTemplateGroupKey;
  title: string;
  description: string;
};

export const MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS = 5;
export const RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION = 1 as const;

export const RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUPS = [
  {
    key: 'request',
    title: 'Request',
    description: 'Initial request receipts while availability is being checked.',
  },
  {
    key: 'confirmation',
    title: 'Confirmation',
    description: 'Confirmed reservation emails sent when a table is secured.',
  },
  {
    key: 'changes',
    title: 'Changes',
    description: 'Reservation change request and confirmation messages.',
  },
  {
    key: 'cancellation',
    title: 'Cancellation',
    description: 'Guest or venue cancellation flows and rejected requests.',
  },
  {
    key: 'reminder',
    title: 'Reminder',
    description: 'Pre-arrival reminders and same-day arrival nudges.',
  },
  {
    key: 'review',
    title: 'Review',
    description: 'Post-visit review request messages.',
  },
] as const satisfies ReadonlyArray<TemplateGroupDefinition>;

export const RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS = [
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
] as const;

export type RestaurantBookingEmailTemplateKey =
  (typeof RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS)[number];

export type RestaurantEmailTemplateVariant = {
  id: string;
  name: string;
  subject: string;
  preheader: string;
  headline: string;
  intro: string;
  cue: string;
  ask: string;
  ctaLabel: string;
  isActive: boolean;
  order: number;
};

export type RestaurantEmailTemplateOverride = {
  variants: RestaurantEmailTemplateVariant[];
};

export type RestaurantEmailTemplatesDocument = {
  version: typeof RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION;
  templates: Partial<Record<RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateOverride>>;
};

export type BookingEmailTemplateVariableMap = {
  name: string;
  firstName: string;
  venue: string;
  date: string;
  time: string;
  party: string;
};

export const BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS = [
  'name',
  'firstName',
  'venue',
  'date',
  'time',
  'party',
] as const;

export type BookingEmailTemplateVariableKey =
  (typeof BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS)[number];

export const BOOKING_EMAIL_TEMPLATE_VARIABLE_TOKENS = BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS.map(
  (key) => `{{${key}}}` as const,
);

const BOOKING_EMAIL_TEMPLATE_VARIABLE_KEY_SET = new Set<string>(BOOKING_EMAIL_TEMPLATE_VARIABLE_KEYS);
const BOOKING_EMAIL_TEMPLATE_TOKEN_PATTERN = /\{\{([\w]+)\}\}/g;

function buildDefaultVariantSubject(headline: string): string {
  return `${headline} - {{venue}}`;
}

type TemplateDefinition = (typeof TEMPLATE_DEFINITIONS)[number];

type TemplateDefinitionMap = Record<RestaurantBookingEmailTemplateKey, TemplateDefinition>;

const TEMPLATE_DEFINITION_MAP = TEMPLATE_DEFINITIONS.reduce<TemplateDefinitionMap>((acc, definition) => {
  acc[definition.key] = definition;
  return acc;
}, {} as TemplateDefinitionMap);

const LEGACY_TO_TEMPLATE_KEYS: Record<string, RestaurantBookingEmailTemplateKey[]> = {
  created: ['request_received', 'confirmation'],
  updated: ['modification_confirmed'],
  reminder: ['reminder_24h'],
  reminder_24h: ['reminder_24h'],
  reminder_short: ['reminder_short'],
  request_received: ['request_received'],
  confirmation: ['confirmation'],
  modification_pending: ['modification_pending'],
  modification_confirmed: ['modification_confirmed'],
  cancelled: ['cancelled'],
  booking_rejected: ['booking_rejected'],
  restaurant_cancellation: ['restaurant_cancellation'],
  review_request: ['review_request'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNonEmptyString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function sanitizeVariant(
  variant: unknown,
  fallback: RestaurantEmailTemplateVariant,
  order: number,
): RestaurantEmailTemplateVariant {
  if (!isRecord(variant)) {
    return { ...fallback, order };
  }

  return {
    id: toNonEmptyString(variant.id, fallback.id),
    name: toNonEmptyString(variant.name, fallback.name),
    subject: toNonEmptyString(variant.subject, fallback.subject),
    preheader: toNonEmptyString(variant.preheader, fallback.preheader),
    headline: toNonEmptyString(variant.headline, fallback.headline),
    intro: toNonEmptyString(variant.intro, fallback.intro),
    cue: typeof variant.cue === 'string' ? variant.cue.trim() : fallback.cue,
    ask: typeof variant.ask === 'string' ? variant.ask.trim() : fallback.ask,
    ctaLabel: toNonEmptyString(variant.ctaLabel, fallback.ctaLabel),
    isActive: typeof variant.isActive === 'boolean' ? variant.isActive : fallback.isActive,
    order:
      typeof variant.order === 'number' && Number.isFinite(variant.order)
        ? Math.max(0, Math.trunc(variant.order))
        : order,
  };
}

function cloneVariants(
  variants: ReadonlyArray<{
    id: string;
    name: string;
    subject: string;
    preheader: string;
    headline: string;
    intro: string;
    cue: string;
    ask: string;
    ctaLabel: string;
  }>,
): RestaurantEmailTemplateVariant[] {
  return variants.map((variant, index) => ({
    ...variant,
    isActive: true,
    order: index,
  }));
}

function sortVariants(variants: RestaurantEmailTemplateVariant[]): RestaurantEmailTemplateVariant[] {
  return [...variants].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.name.localeCompare(right.name);
  });
}

function createLegacyVariant(
  key: RestaurantBookingEmailTemplateKey,
  legacy: Record<string, unknown>,
): RestaurantEmailTemplateVariant {
  const fallback = getDefaultTemplateVariants(key)[0];

  return {
    id: `${key}-legacy-1`,
    name: 'Imported custom variant',
    subject: toNonEmptyString(legacy.subject, fallback?.subject ?? buildDefaultVariantSubject(fallback?.headline ?? 'Update')),
    preheader: toNonEmptyString(legacy.preheader, fallback?.preheader ?? toNonEmptyString(legacy.intro, fallback?.intro ?? '')),
    headline: toNonEmptyString(legacy.headline, fallback?.headline ?? ''),
    intro: toNonEmptyString(legacy.intro, fallback?.intro ?? ''),
    cue: fallback?.cue ?? '',
    ask: fallback?.ask ?? '',
    ctaLabel: toNonEmptyString(legacy.ctaLabel, fallback?.ctaLabel ?? ''),
    isActive: true,
    order: 0,
  };
}

function normalizeTemplateOverride(
  key: RestaurantBookingEmailTemplateKey,
  value: unknown,
): RestaurantEmailTemplateOverride | null {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.variants)) {
    const defaults = getDefaultTemplateVariants(key);
    const variants = sortVariants(
      value.variants
        .slice(0, MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS)
        .map((variant, index) => sanitizeVariant(variant, defaults[index] ?? defaults[0], index)),
    );

    return variants.length > 0 ? { variants } : null;
  }

  if ('headline' in value || 'intro' in value || 'ctaLabel' in value) {
    return { variants: [createLegacyVariant(key, value)] };
  }

  return null;
}

export function isRestaurantBookingEmailTemplateKey(
  value: string | null | undefined,
): value is RestaurantBookingEmailTemplateKey {
  return (
    typeof value === 'string' &&
    (RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}

export function getRestaurantBookingEmailTemplateGroups(): readonly TemplateGroupDefinition[] {
  return RESTAURANT_BOOKING_EMAIL_TEMPLATE_GROUPS;
}

export function getRestaurantBookingEmailTemplateCatalog(): readonly TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS;
}

export function getRestaurantBookingEmailTemplateDefinition(
  key: RestaurantBookingEmailTemplateKey,
): TemplateDefinition {
  return TEMPLATE_DEFINITION_MAP[key];
}

export function getDefaultTemplateVariants(
  key: RestaurantBookingEmailTemplateKey,
): RestaurantEmailTemplateVariant[] {
  return cloneVariants(getRestaurantBookingEmailTemplateDefinition(key).defaultVariants);
}

export function getDefaultRestaurantEmailTemplatesDocument(): RestaurantEmailTemplatesDocument {
  return {
    version: RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION,
    templates: {},
  };
}

export function normalizeRestaurantEmailTemplatesDocument(
  input: unknown,
): RestaurantEmailTemplatesDocument | null {
  if (!isRecord(input)) {
    return null;
  }

  const templates: Partial<Record<RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateOverride>> = {};

  if (input.version === RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION && isRecord(input.templates)) {
    for (const key of RESTAURANT_BOOKING_EMAIL_TEMPLATE_KEYS) {
      const normalized = normalizeTemplateOverride(key, input.templates[key]);
      if (normalized) {
        templates[key] = normalized;
      }
    }

    return {
      version: RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION,
      templates,
    };
  }

  for (const [legacyKey, value] of Object.entries(input)) {
    const mappedKeys = LEGACY_TO_TEMPLATE_KEYS[legacyKey];
    if (!mappedKeys?.length) continue;

    for (const key of mappedKeys) {
      const normalized = normalizeTemplateOverride(key, value);
      if (normalized) {
        templates[key] = normalized;
      }
    }
  }

  if (Object.keys(templates).length === 0) {
    return null;
  }

  return {
    version: RESTAURANT_EMAIL_TEMPLATES_DOCUMENT_VERSION,
    templates,
  };
}

export function getTemplateOverrideFromDocument(
  document: RestaurantEmailTemplatesDocument | null | undefined,
  key: RestaurantBookingEmailTemplateKey,
): RestaurantEmailTemplateOverride | null {
  return document?.templates[key] ?? null;
}

export function getTemplateVariantsFromDocument(
  document: RestaurantEmailTemplatesDocument | null | undefined,
  key: RestaurantBookingEmailTemplateKey,
): RestaurantEmailTemplateVariant[] {
  return getTemplateOverrideFromDocument(document, key)?.variants
    ? sortVariants(getTemplateOverrideFromDocument(document, key)!.variants)
    : [];
}

export function getActiveTemplateVariants(
  variants: RestaurantEmailTemplateVariant[],
): RestaurantEmailTemplateVariant[] {
  return sortVariants(variants).filter((variant) => variant.isActive);
}

export function getEffectiveTemplateVariants(
  key: RestaurantBookingEmailTemplateKey,
  document: RestaurantEmailTemplatesDocument | null | undefined,
): {
  variants: RestaurantEmailTemplateVariant[];
  source: 'default' | 'custom';
} {
  const overrideVariants = getTemplateVariantsFromDocument(document, key);
  const activeVariants = getActiveTemplateVariants(overrideVariants);
  if (activeVariants.length > 0) {
    return { variants: overrideVariants, source: 'custom' };
  }

  return { variants: getDefaultTemplateVariants(key), source: 'default' };
}

export function buildEditableTemplateVariants(
  key: RestaurantBookingEmailTemplateKey,
  document: RestaurantEmailTemplatesDocument | null | undefined,
): RestaurantEmailTemplateVariant[] {
  const overrideVariants = getTemplateVariantsFromDocument(document, key);
  if (overrideVariants.length > 0) {
    return overrideVariants;
  }
  return getDefaultTemplateVariants(key);
}

export function buildDeterministicVariantSeed(params: {
  bookingId: string;
  templateKey: RestaurantBookingEmailTemplateKey;
  recipientEmail?: string | null;
}): string {
  return [params.bookingId, params.templateKey, params.recipientEmail ?? ''].join('|');
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickDeterministicTemplateVariant(
  variants: RestaurantEmailTemplateVariant[],
  seed: string,
): RestaurantEmailTemplateVariant {
  const activeVariants = getActiveTemplateVariants(variants);
  const pool = activeVariants.length > 0 ? activeVariants : sortVariants(variants);
  if (pool.length === 0) {
    throw new Error('At least one email template variant is required');
  }

  return pool[simpleHash(seed) % pool.length]!;
}

export function extractRestaurantEmailTemplateTokens(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(BOOKING_EMAIL_TEMPLATE_TOKEN_PATTERN)) {
    const token = match[1]?.trim();
    if (token) {
      found.add(token);
    }
  }

  return [...found];
}

export function getUnknownRestaurantEmailTemplateTokens(text: string): string[] {
  return extractRestaurantEmailTemplateTokens(text).filter((token) => !BOOKING_EMAIL_TEMPLATE_VARIABLE_KEY_SET.has(token));
}

export function buildRestaurantEmailTemplateVariantSignature(
  variant: Pick<RestaurantEmailTemplateVariant, 'subject' | 'preheader' | 'headline' | 'intro' | 'cue' | 'ask' | 'ctaLabel'>,
): string {
  return JSON.stringify({
    subject: variant.subject.trim().toLowerCase(),
    preheader: variant.preheader.trim().toLowerCase(),
    headline: variant.headline.trim().toLowerCase(),
    intro: variant.intro.trim().toLowerCase(),
    cue: variant.cue.trim().toLowerCase(),
    ask: variant.ask.trim().toLowerCase(),
    ctaLabel: variant.ctaLabel.trim().toLowerCase(),
  });
}

export function interpolateRestaurantEmailTemplateText(
  text: string,
  variables: BookingEmailTemplateVariableMap,
): string {
  return text.replace(BOOKING_EMAIL_TEMPLATE_TOKEN_PATTERN, (_, rawKey: string) => {
    const key = rawKey as keyof BookingEmailTemplateVariableMap;
    return variables[key] ?? '';
  });
}

export function getTemplateStatusLabel(source: 'default' | 'custom'): 'Default' | 'Customized' {
  return source === 'custom' ? 'Customized' : 'Default';
}
