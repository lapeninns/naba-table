import { z } from 'zod';

import { normalizeTime, toMinutes } from '@reserve/shared/time';

export type OccasionKey = string;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const occasionAvailabilityRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('anytime') as z.ZodLiteral<'anytime'>,
  }),
  z.object({
    kind: z.literal('time_window') as z.ZodLiteral<'time_window'>,
    start: z.string().min(1),
    end: z.string().min(1),
  }),
  z.object({
    kind: z.literal('month_only') as z.ZodLiteral<'month_only'>,
    months: z.array(z.number().int().min(1).max(12)).min(1),
  }),
  z.object({
    kind: z.literal('date_range') as z.ZodLiteral<'date_range'>,
    start: z.string().regex(DATE_REGEX),
    end: z.string().regex(DATE_REGEX),
  }),
  z.object({
    kind: z.literal('specific_dates') as z.ZodLiteral<'specific_dates'>,
    dates: z.array(z.string().regex(DATE_REGEX)).min(1),
  }),
]);

export type OccasionAvailabilityRule = z.infer<typeof occasionAvailabilityRuleSchema>;

export type OccasionDefinition = {
  key: OccasionKey;
  label: string;
  shortLabel: string;
  description: string | null;
  availability: OccasionAvailabilityRule[];
  defaultDurationMinutes: number;
  displayOrder: number;
  isActive: boolean;
};

export type RawOccasionRow = {
  key: string;
  label: string;
  short_label?: string | null;
  description?: string | null;
  availability?: unknown;
  default_duration_minutes?: number | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

const ensureTime = (value: string): string | null => {
  const normalized = normalizeTime(value);
  if (!normalized) return null;
  return normalized;
};

const sanitizeRule = (rule: OccasionAvailabilityRule): OccasionAvailabilityRule | null => {
  switch (rule.kind) {
    case 'anytime':
      return rule;
    case 'time_window': {
      const start = ensureTime(rule.start);
      const end = ensureTime(rule.end);
      if (!start || !end) {
        return null;
      }
      if (toMinutes(end) <= toMinutes(start)) {
        return null;
      }
      return { kind: 'time_window', start, end };
    }
    case 'month_only': {
      const months = Array.from(
        new Set(rule.months.filter((month) => month >= 1 && month <= 12)),
      ).sort((a, b) => a - b);
      if (months.length === 0) {
        return null;
      }
      return { kind: 'month_only', months };
    }
    case 'date_range': {
      const { start, end } = rule;
      if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
        return null;
      }
      if (start > end) {
        return { kind: 'date_range', start: end, end: start };
      }
      return rule;
    }
    case 'specific_dates': {
      const dates = Array.from(new Set(rule.dates.filter((date) => DATE_REGEX.test(date)))).sort();
      if (dates.length === 0) {
        return null;
      }
      return { kind: 'specific_dates', dates };
    }
    default:
      return null;
  }
};

const toAvailability = (value: unknown): OccasionAvailabilityRule[] => {
  if (!value) {
    return [];
  }
  try {
    const parsed = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? JSON.parse(value)
        : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    const result: OccasionAvailabilityRule[] = [];
    for (const entry of parsed) {
      const candidate = occasionAvailabilityRuleSchema.safeParse(entry);
      if (!candidate.success) {
        continue;
      }
      const sanitized = sanitizeRule(candidate.data);
      if (sanitized) {
        result.push(sanitized);
      }
    }
    return result;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[occasions] failed to parse availability', { value, error });
    }
    return [];
  }
};

export function toOccasionDefinition(row: RawOccasionRow): OccasionDefinition {
  const trimmedKey = row.key?.trim();
  if (!trimmedKey) {
    throw new Error('Occasion key is required');
  }
  const trimmedLabel = row.label?.trim() ?? trimmedKey;
  const shortLabelRaw = row.short_label?.trim();
  const availability = toAvailability(row.availability);
  const defaultDurationMinutes =
    row.default_duration_minutes && Number.isFinite(row.default_duration_minutes)
      ? Math.max(1, Math.floor(row.default_duration_minutes))
      : 90;
  const displayOrder =
    row.display_order && Number.isFinite(row.display_order) ? Math.floor(row.display_order) : 0;
  const isActive = row.is_active ?? true;

  return {
    key: trimmedKey,
    label: trimmedLabel,
    shortLabel: shortLabelRaw && shortLabelRaw.length > 0 ? shortLabelRaw : trimmedLabel,
    description: row.description ?? null,
    availability,
    defaultDurationMinutes,
    displayOrder,
    isActive,
  } satisfies OccasionDefinition;
}

export function sortOccasions(definitions: OccasionDefinition[]): OccasionDefinition[] {
  return [...definitions].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.label.localeCompare(b.label);
  });
}

export type OccasionCatalog = {
  definitions: OccasionDefinition[];
  byKey: Map<OccasionKey, OccasionDefinition>;
  orderedKeys: OccasionKey[];
};

export function toOccasionCatalog(definitions: OccasionDefinition[]): OccasionCatalog {
  const active = definitions.filter((definition) => definition.isActive);
  const sorted = sortOccasions(active);
  const byKey = new Map<OccasionKey, OccasionDefinition>();
  const orderedKeys: OccasionKey[] = [];
  for (const definition of sorted) {
    byKey.set(definition.key, definition);
    orderedKeys.push(definition.key);
  }
  return { definitions: sorted, byKey, orderedKeys };
}

export function getFallbackOccasionCatalog(): OccasionCatalog {
  return toOccasionCatalog([]);
}

export type OccasionAvailabilityContext = {
  date: string;
  time?: string | null;
  timezone: string;
};

const getMonthInTimezone = (date: string, timezone: string): number => {
  try {
    const reference = new Date(`${date}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: timezone });
    const month = Number.parseInt(formatter.format(reference), 10);
    if (Number.isFinite(month)) {
      return month;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[occasions] failed to resolve month', { date, timezone, error });
    }
  }
  const fallback = new Date(`${date}T00:00:00Z`);
  return fallback.getUTCMonth() + 1;
};

const isWithinTimeWindow = (
  time: string | null | undefined,
  rule: Extract<OccasionAvailabilityRule, { kind: 'time_window' }>,
): boolean => {
  if (!time) {
    return true;
  }
  const normalized = normalizeTime(time);
  if (!normalized) {
    return false;
  }
  const target = toMinutes(normalized);
  return target >= toMinutes(rule.start) && target < toMinutes(rule.end);
};

export function isOccasionAvailable(
  definition: OccasionDefinition,
  context: OccasionAvailabilityContext,
): boolean {
  if (!definition.isActive) {
    return false;
  }
  if (definition.availability.length === 0) {
    return true;
  }
  return definition.availability.every((rule) => {
    switch (rule.kind) {
      case 'anytime':
        return true;
      case 'time_window':
        return isWithinTimeWindow(context.time ?? null, rule);
      case 'month_only': {
        const month = getMonthInTimezone(context.date, context.timezone);
        return rule.months.includes(month);
      }
      case 'date_range':
        return context.date >= rule.start && context.date <= rule.end;
      case 'specific_dates':
        return rule.dates.includes(context.date);
      default:
        return true;
    }
  });
}

export function coerceOccasionKey(
  options: OccasionCatalog,
  candidate: OccasionKey | null | undefined,
  fallback?: OccasionKey,
): OccasionKey {
  if (candidate && options.byKey.has(candidate)) {
    return candidate;
  }
  if (fallback && options.byKey.has(fallback)) {
    return fallback;
  }
  return options.orderedKeys[0] ?? fallback ?? 'dinner';
}
