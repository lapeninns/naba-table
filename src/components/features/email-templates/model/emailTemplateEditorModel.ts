import {
  buildRestaurantEmailTemplateVariantSignature,
  getDefaultTemplateVariants,
  getUnknownRestaurantEmailTemplateTokens,
} from '@/lib/restaurants/email-templates';

import type {
  BookingEmailTemplateVariableKey,
  RestaurantBookingEmailTemplateKey,
  RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';

/**
 * Pure rules for the email templates editor. Limits and required fields mirror
 * `updateRestaurantEmailTemplateSchema` (app/api/ops/restaurants/schema.ts), so a draft the
 * editor accepts is one the server saves.
 */

export type VariantField =
  | 'name'
  | 'subject'
  | 'preheader'
  | 'headline'
  | 'intro'
  | 'cue'
  | 'ask'
  | 'ctaLabel';

export type CopyField = Exclude<VariantField, 'name'>;

export const FIELD_LIMITS: Record<VariantField, number> = {
  name: 80,
  subject: 140,
  preheader: 180,
  headline: 140,
  intro: 280,
  cue: 180,
  ask: 180,
  ctaLabel: 60,
};

export const FIELD_LABELS: Record<VariantField, string> = {
  name: 'Internal name',
  subject: 'Subject line',
  preheader: 'Preview text',
  headline: 'Headline',
  intro: 'Message',
  cue: 'Photo cue',
  ask: 'Review ask',
  ctaLabel: 'Button label',
};

export const FIELD_HELP: Partial<Record<VariantField, string>> = {
  subject: 'Shown in the inbox before the email is opened.',
  preheader: 'The grey line after the subject in most inboxes.',
  intro:
    'The booking date, time, party size and reference are always shown below this message, so you do not need to repeat them.',
  cue: 'Optional. A short, secondary note shown below the message. Leave empty to hide it.',
  ask: 'Optional. One light line after the message. Do not add tasks before the review link.',
};

const REQUIRED_FIELDS = new Set<VariantField>([
  'name',
  'subject',
  'preheader',
  'headline',
  'intro',
  'ctaLabel',
]);

export function isRequiredField(field: VariantField): boolean {
  return REQUIRED_FIELDS.has(field);
}

export const MULTILINE_FIELDS = new Set<VariantField>(['intro', 'cue', 'ask']);

export const TEMPLATE_VARIABLES: ReadonlyArray<{
  key: BookingEmailTemplateVariableKey;
  description: string;
  sample: string;
}> = [
  { key: 'firstName', description: 'Guest first name', sample: 'Alex' },
  { key: 'venue', description: 'Venue name', sample: 'Your venue name' },
  { key: 'date', description: 'Booking date', sample: 'Wed, 8 Apr' },
  { key: 'time', description: 'Booking time', sample: '20:00' },
  { key: 'party', description: 'Party size', sample: '4 people' },
  { key: 'name', description: 'Guest first name (older alias)', sample: 'Alex' },
];

/** Where each email's button goes. Mirrors `resolveCtaUrlForTemplate` in server/emails/bookings.ts. */
export const CTA_DESTINATIONS: Record<RestaurantBookingEmailTemplateKey, string> = {
  request_received: 'The guest’s manage-booking page',
  confirmation: 'The guest’s manage-booking page',
  modification_pending: 'The guest’s manage-booking page',
  modification_confirmed: 'The guest’s manage-booking page',
  cancelled: 'Your venue’s booking page',
  booking_rejected: 'Your venue’s booking page',
  restaurant_cancellation: 'Your venue’s booking page',
  review_request: 'Your Google review link (Google Maps if not set, then the manage-booking page)',
  reminder_24h: 'Google Maps directions (the manage-booking page if not set)',
  reminder_short: 'Google Maps directions (the manage-booking page if not set)',
};

/** The booking the server renders previews and tests with (`buildPreviewBooking`). */
export const SAMPLE_BOOKING_DESCRIPTION =
  'Alex Johnson · 4 people · Wed 8 Apr, 20:00 · ref PREVIEW42';

export function templateSupportsCue(key: RestaurantBookingEmailTemplateKey): boolean {
  return key === 'confirmation' || key === 'reminder_24h';
}

export function templateSupportsAsk(key: RestaurantBookingEmailTemplateKey): boolean {
  return key === 'review_request';
}

export function copyFieldsFor(key: RestaurantBookingEmailTemplateKey): CopyField[] {
  return [
    'subject',
    'preheader',
    'headline',
    'intro',
    ...(templateSupportsCue(key) ? (['cue'] as const) : []),
    ...(templateSupportsAsk(key) ? (['ask'] as const) : []),
    'ctaLabel',
  ];
}

export type VariantProblems = Partial<Record<VariantField, string>>;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Field problems for one variant, in field order. Only fields this email shows are checked. */
export function variantProblems(
  variant: RestaurantEmailTemplateVariant,
  key: RestaurantBookingEmailTemplateKey,
): VariantProblems {
  const problems: VariantProblems = {};
  for (const field of ['name', ...copyFieldsFor(key)] as VariantField[]) {
    const value = variant[field] ?? '';
    const unknown = getUnknownRestaurantEmailTemplateTokens(value);
    const over = value.trim().length - FIELD_LIMITS[field];
    if (isRequiredField(field) && !value.trim()) {
      problems[field] = `${FIELD_LABELS[field]} is empty. Add text, or reset this variant.`;
    } else if (unknown.length > 0 && field !== 'name') {
      problems[field] =
        `Unknown variable ${unknown.map((token) => `{{${token}}}`).join(', ')}. Guests would see a blank here. Use one of the variables above.`;
    } else if (over > 0) {
      problems[field] =
        `${FIELD_LABELS[field]} is ${plural(over, 'character')} over the ${FIELD_LIMITS[field]} limit.`;
    }
  }
  return problems;
}

export function hasProblems(problems: VariantProblems): boolean {
  return Object.keys(problems).length > 0;
}

/** Another live variant with the same guest-facing wording, which the server refuses to save. */
export function findDuplicateLiveVariant(
  variants: ReadonlyArray<RestaurantEmailTemplateVariant>,
  variant: RestaurantEmailTemplateVariant,
): RestaurantEmailTemplateVariant | null {
  if (!variant.isActive) return null;
  const signature = buildRestaurantEmailTemplateVariantSignature(variant);
  return (
    variants.find(
      (other) =>
        other.id !== variant.id &&
        other.isActive &&
        buildRestaurantEmailTemplateVariantSignature(other) === signature,
    ) ?? null
  );
}

export type SaveBlocker =
  | { kind: 'no-live' }
  | { kind: 'duplicate'; variantId: string; otherName: string }
  | { kind: 'field'; variantId: string; field: VariantField; message: string };

/** Everything that stops a template saving, first problem first. Empty means it can be saved. */
export function saveBlockers(
  variants: ReadonlyArray<RestaurantEmailTemplateVariant>,
  key: RestaurantBookingEmailTemplateKey,
): SaveBlocker[] {
  const blockers: SaveBlocker[] = [];
  for (const variant of variants) {
    for (const [field, message] of Object.entries(variantProblems(variant, key))) {
      blockers.push({
        kind: 'field',
        variantId: variant.id,
        field: field as VariantField,
        message,
      });
    }
  }
  // Each later copy is reported against the first live variant with the same wording.
  variants.forEach((variant, index) => {
    const twin = findDuplicateLiveVariant(variants.slice(0, index), variant);
    if (twin) blockers.push({ kind: 'duplicate', variantId: variant.id, otherName: twin.name });
  });
  if (!variants.some((variant) => variant.isActive)) {
    blockers.push({ kind: 'no-live' });
  }
  return blockers;
}

export function describeSaveBlocker(
  blocker: SaveBlocker,
  variants: ReadonlyArray<RestaurantEmailTemplateVariant>,
): string {
  if (blocker.kind === 'no-live') {
    return 'Set at least one variant live, or reset this email to the Nabatable defaults.';
  }
  const name =
    variants.find((variant) => variant.id === blocker.variantId)?.name || 'Untitled variant';
  if (blocker.kind === 'duplicate') {
    return `${name} has the same copy as ${blocker.otherName}. Change the wording or pause one.`;
  }
  return `${name}: ${blocker.message}`;
}

export type CounterState = { text: string; tone: 'normal' | 'low' | 'over' };

export function counterState(field: VariantField, value: string): CounterState {
  const limit = FIELD_LIMITS[field];
  const left = limit - value.length;
  if (left < 0) return { text: `${-left} over`, tone: 'over' };
  if (left <= 25) return { text: `${left} left`, tone: 'low' };
  return { text: `${value.length} / ${limit}`, tone: 'normal' };
}

/** Insert `token` over the selection, padding with a space only where the text needs one. */
export function insertToken(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  token: string,
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  const padLeft = before && !/\s$/.test(before) ? ' ' : '';
  const padRight = after && !/^\s/.test(after) ? ' ' : '';
  const inserted = `${padLeft}${token}${padRight}`;
  return {
    value: `${before}${inserted}${after}`,
    caret: before.length + padLeft.length + token.length,
  };
}

function truncateName(name: string): string {
  return name.length > FIELD_LIMITS.name ? name.slice(0, FIELD_LIMITS.name) : name;
}

/** A new variant starts paused from the first default, so it never sends before it is ready. */
export function buildNewVariant(
  key: RestaurantBookingEmailTemplateKey,
  variants: ReadonlyArray<RestaurantEmailTemplateVariant>,
  id: string,
): RestaurantEmailTemplateVariant {
  const seed = getDefaultTemplateVariants(key)[0]!;
  return {
    ...seed,
    id,
    name: `Variant ${variants.length + 1}`,
    isActive: false,
    order: variants.length,
  };
}

export function duplicateVariant(
  source: RestaurantEmailTemplateVariant,
  order: number,
  id: string,
): RestaurantEmailTemplateVariant {
  return { ...source, id, name: truncateName(`${source.name} copy`), isActive: false, order };
}

export function createVariantId(key: RestaurantBookingEmailTemplateKey): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${key}-${crypto.randomUUID()}`;
  }
  return `${key}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
