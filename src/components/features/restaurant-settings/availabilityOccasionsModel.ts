import type { TurnBandInput } from '@/services/ops/restaurants';
import type { OccasionAvailabilityRule, OccasionDefinition } from '@reserve/shared/occasions';

export const SERVICE_WINDOW_KEYS = new Set<string>(['lunch', 'dinner']);

export const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
] as const;

export type RuleDraft = {
  id: string;
  kind: OccasionAvailabilityRule['kind'];
  start: string;
  end: string;
  months: number[];
  rangeStart: string;
  rangeEnd: string;
  specificDates: string[];
  pendingDate: string;
};

export type OccasionFormState = {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  defaultDurationMinutes: number;
  displayOrder: number;
  availabilityRules: RuleDraft[];
  isActive: boolean;
  turnBands: TurnBandInput[];
};

export type OccasionFormErrors = Partial<Record<'key' | 'label' | 'availability', string>>;

const buildRuleId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `rule-${Math.random().toString(36).slice(2, 10)}`;

export const createRuleDraft = (kind: OccasionAvailabilityRule['kind'] = 'anytime'): RuleDraft => ({
  id: buildRuleId(),
  kind,
  start: '',
  end: '',
  months: [],
  rangeStart: '',
  rangeEnd: '',
  specificDates: [],
  pendingDate: '',
});

export const createEmptyOccasionForm = (): OccasionFormState => ({
  key: '',
  label: '',
  shortLabel: '',
  description: '',
  defaultDurationMinutes: 90,
  displayOrder: 10,
  availabilityRules: [createRuleDraft('anytime')],
  isActive: true,
  turnBands: [],
});

export function isServiceWindowOccasion(key: string | null | undefined): boolean {
  return Boolean(key && SERVICE_WINDOW_KEYS.has(key));
}

export function toRuleDrafts(availability: OccasionDefinition['availability']): RuleDraft[] {
  if (!availability || availability.length === 0) {
    return [createRuleDraft('anytime')];
  }

  return availability.map((rule) => {
    switch (rule.kind) {
      case 'anytime':
        return createRuleDraft('anytime');
      case 'time_window':
        return { ...createRuleDraft('time_window'), start: rule.start, end: rule.end };
      case 'month_only':
        return { ...createRuleDraft('month_only'), months: [...rule.months] };
      case 'date_range':
        return {
          ...createRuleDraft('date_range'),
          rangeStart: rule.start,
          rangeEnd: rule.end,
        };
      case 'specific_dates':
        return {
          ...createRuleDraft('specific_dates'),
          specificDates: [...rule.dates],
        };
      default:
        return createRuleDraft('anytime');
    }
  });
}

export function buildAvailabilityRules(
  drafts: RuleDraft[],
): { valid: true; rules: OccasionDefinition['availability'] } | { valid: false; error: string } {
  const rules: OccasionDefinition['availability'] = [];

  for (const draft of drafts) {
    switch (draft.kind) {
      case 'anytime':
        rules.push({ kind: 'anytime' });
        break;
      case 'time_window': {
        if (!draft.start || !draft.end) {
          return {
            valid: false,
            error: 'Add both a start and end time for each time-window rule.',
          };
        }
        if (draft.end <= draft.start) {
          return { valid: false, error: 'Time-window end times must be later than start times.' };
        }
        rules.push({ kind: 'time_window', start: draft.start, end: draft.end });
        break;
      }
      case 'month_only': {
        if (draft.months.length === 0) {
          return { valid: false, error: 'Select at least one month for each month-based rule.' };
        }
        rules.push({ kind: 'month_only', months: draft.months });
        break;
      }
      case 'date_range': {
        if (!draft.rangeStart || !draft.rangeEnd) {
          return { valid: false, error: 'Add both dates for each date-range rule.' };
        }
        rules.push({
          kind: 'date_range',
          start: draft.rangeStart,
          end: draft.rangeEnd,
        });
        break;
      }
      case 'specific_dates': {
        if (draft.specificDates.length === 0) {
          return { valid: false, error: 'Add at least one date for each specific-date rule.' };
        }
        rules.push({ kind: 'specific_dates', dates: draft.specificDates });
        break;
      }
      default:
        return { valid: false, error: 'Choose a valid availability rule type.' };
    }
  }

  return { valid: true, rules };
}

export function describeRuleDraft(rule: RuleDraft): string {
  switch (rule.kind) {
    case 'anytime':
      return 'Available any time guests can book.';
    case 'time_window':
      return rule.start && rule.end
        ? `Available between ${rule.start} and ${rule.end}.`
        : 'Choose the start and end time for this window.';
    case 'month_only':
      return rule.months.length > 0
        ? `Available in ${formatMonthList(rule.months)}.`
        : 'Select the months when this occasion should appear.';
    case 'date_range':
      return rule.rangeStart && rule.rangeEnd
        ? `Available from ${rule.rangeStart} through ${rule.rangeEnd}.`
        : 'Choose the date range when this occasion should appear.';
    case 'specific_dates':
      return rule.specificDates.length > 0
        ? `Available on ${rule.specificDates.join(', ')}.`
        : 'Add one or more individual dates for this occasion.';
    default:
      return 'Choose when guests can select this occasion.';
  }
}

export function formatAvailabilitySummary(
  availability: OccasionDefinition['availability'],
): string {
  if (!availability || availability.length === 0) {
    return 'Always available';
  }

  return availability
    .map((rule) => {
      switch (rule.kind) {
        case 'anytime':
          return 'Always available';
        case 'time_window':
          return `${rule.start}-${rule.end}`;
        case 'month_only':
          return `Months: ${formatMonthList(rule.months)}`;
        case 'date_range':
          return `${rule.start} to ${rule.end}`;
        case 'specific_dates':
          return rule.dates.join(', ');
        default:
          return 'Custom rule';
      }
    })
    .join(' · ');
}

function formatMonthList(months: number[]): string {
  return months
    .map((month) => MONTH_OPTIONS.find((option) => option.value === month)?.label ?? month)
    .join(', ');
}
