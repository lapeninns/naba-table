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

type TemplateDefinition = {
  key: RestaurantBookingEmailTemplateKey;
  title: string;
  description: string;
  group: RestaurantBookingEmailTemplateGroupKey;
  supportsCtaLabel: boolean;
  defaultVariants: Array<{
    id: string;
    name: string;
    headline: string;
    intro: string;
    ctaLabel: string;
  }>;
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
  headline: string;
  intro: string;
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

const TEMPLATE_DEFINITIONS = [
  {
    key: 'request_received',
    title: 'Request Received',
    description: 'Pending booking requests awaiting review.',
    group: 'request',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'request-received-default-1',
        name: 'Request Received',
        headline: 'Request Received 🤞',
        intro: "We've received your request for {{venue}}. Hang tight while we check availability!",
        ctaLabel: 'Check Status',
      },
    ],
  },
  {
    key: 'confirmation',
    title: 'Confirmation',
    description: 'Confirmed reservations for accepted bookings.',
    group: 'confirmation',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'confirmation-default-1',
        name: 'Booking Confirmed',
        headline: 'Booking Confirmed 🎉',
        intro: "Great news, {{firstName}}! Your table at {{venue}} is secured. We've added this to your upcoming bookings.",
        ctaLabel: 'Manage Booking',
      },
      {
        id: 'confirmation-default-2',
        name: "You're In!",
        headline: "You're In! 🥂",
        intro: "{{firstName}}, your reservation at {{venue}} is confirmed. We can't wait to host you!",
        ctaLabel: 'Manage Booking',
      },
      {
        id: 'confirmation-default-3',
        name: 'Table Secured',
        headline: 'Table Secured 🍽️',
        intro: "All set, {{firstName}}. We've reserved a spot for you at {{venue}}. See you soon!",
        ctaLabel: 'Manage Booking',
      },
    ],
  },
  {
    key: 'modification_pending',
    title: 'Change Requested',
    description: 'Guest-requested reservation changes awaiting review.',
    group: 'changes',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'modification-pending-default-1',
        name: 'Change Requested',
        headline: 'Change Requested 📝',
        intro: "We're reviewing your requested changes at {{venue}}. We'll get back to you and confirm shortly.",
        ctaLabel: 'View Request',
      },
    ],
  },
  {
    key: 'modification_confirmed',
    title: 'Changes Confirmed',
    description: 'Confirmed changes for an existing reservation.',
    group: 'changes',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'modification-confirmed-default-1',
        name: 'Changes Confirmed',
        headline: 'Changes Confirmed ✅',
        intro: 'Your updated reservation at {{venue}} is all set! Here are the new details.',
        ctaLabel: 'View Booking',
      },
    ],
  },
  {
    key: 'cancelled',
    title: 'Cancelled',
    description: 'Guest-confirmed cancellations.',
    group: 'cancellation',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'cancelled-default-1',
        name: 'Booking Cancelled',
        headline: 'Booking Cancelled 😔',
        intro: 'As requested, we have cancelled your reservation at {{venue}}. We hope to welcome you another time. 👋',
        ctaLabel: 'Book Again',
      },
    ],
  },
  {
    key: 'booking_rejected',
    title: 'Unavailable',
    description: 'Requests the venue could not accept.',
    group: 'cancellation',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'booking-rejected-default-1',
        name: 'Unavailable',
        headline: 'Unavailable 🚫',
        intro: "We're sorry, {{venue}} is fully booked for your requested time. Maybe try a different date or time? ⏰",
        ctaLabel: 'Try Another Time',
      },
    ],
  },
  {
    key: 'restaurant_cancellation',
    title: 'Venue Cancellation',
    description: 'Venue-initiated cancellations that prompt a rebook.',
    group: 'cancellation',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'restaurant-cancellation-default-1',
        name: 'Venue Cancellation',
        headline: 'Booking Cancelled 😔',
        intro: 'We sincerely apologize. {{venue}} had to cancel your reservation due to unforeseen circumstances.',
        ctaLabel: 'Rebook Now',
      },
    ],
  },
  {
    key: 'review_request',
    title: 'Review Request',
    description: 'Post-visit review prompts.',
    group: 'review',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'review-request-default-1',
        name: 'How was dinner?',
        headline: 'How was dinner? ⭐',
        intro: 'We hope you enjoyed {{venue}}! Would you mind taking 10 seconds to rate your experience? ❤️',
        ctaLabel: 'Leave a Review',
      },
      {
        id: 'review-request-default-2',
        name: 'Rate your experience',
        headline: 'Rate your experience 📝',
        intro: 'Hi {{firstName}}, thanks for dining with us at {{venue}}! How did we do?',
        ctaLabel: 'Leave a Review',
      },
      {
        id: 'review-request-default-3',
        name: "We'd love your feedback",
        headline: "We'd love your feedback 💬",
        intro: 'It was a pleasure hosting you at {{venue}}. Would you share your thoughts with us?',
        ctaLabel: 'Leave a Review',
      },
    ],
  },
  {
    key: 'reminder_24h',
    title: '24 Hour Reminder',
    description: 'Day-before reminder emails.',
    group: 'reminder',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'reminder-24h-default-1',
        name: "Tomorrow's the day",
        headline: "Tomorrow's the day 🥂",
        intro: "Just a quick reminder about your reservation at {{venue}} tomorrow. We can't wait to host you!",
        ctaLabel: 'Get Directions',
      },
      {
        id: 'reminder-24h-default-2',
        name: 'Upcoming reservation',
        headline: 'Upcoming Reservation 📅',
        intro: 'Hi {{firstName}}, getting excited? Your table at {{venue}} is ready for tomorrow.',
        ctaLabel: 'Get Directions',
      },
      {
        id: 'reminder-24h-default-3',
        name: 'See you soon',
        headline: 'See you soon! 👋',
        intro: "This is a quick confirmation that we're ready for your visit to {{venue}} tomorrow.",
        ctaLabel: 'Get Directions',
      },
    ],
  },
  {
    key: 'reminder_short',
    title: 'Arrival Reminder',
    description: 'Same-day or arrival-time reminders.',
    group: 'reminder',
    supportsCtaLabel: true,
    defaultVariants: [
      {
        id: 'reminder-short-default-1',
        name: 'Table Ready',
        headline: 'Table Ready 🍽️',
        intro: "We've prepared your table at {{venue}}. Please head to the host stand when you arrive.",
        ctaLabel: "I'm Here",
      },
    ],
  },
] as const satisfies readonly TemplateDefinition[];

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
    headline: toNonEmptyString(variant.headline, fallback.headline),
    intro: toNonEmptyString(variant.intro, fallback.intro),
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
    headline: string;
    intro: string;
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
    headline: toNonEmptyString(legacy.headline, fallback?.headline ?? ''),
    intro: toNonEmptyString(legacy.intro, fallback?.intro ?? ''),
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

export function interpolateRestaurantEmailTemplateText(
  text: string,
  variables: BookingEmailTemplateVariableMap,
): string {
  return text.replace(/\{\{([\w]+)\}\}/g, (_, rawKey: string) => {
    const key = rawKey as keyof BookingEmailTemplateVariableMap;
    return variables[key] ?? '';
  });
}

export function getTemplateStatusLabel(source: 'default' | 'custom'): 'Default' | 'Customized' {
  return source === 'custom' ? 'Customized' : 'Default';
}
