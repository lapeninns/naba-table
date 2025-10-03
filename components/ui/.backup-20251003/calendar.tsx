'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_CALENDAR_CLASS =
  'cally flex flex-col rounded-lg border border-base-300 bg-base-100 p-3 text-sm shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export type CalendarMode = 'single' | 'multiple' | 'range';

export type CalendarRange = {
  from?: Date | null;
  to?: Date | null;
};

export type CalendarSelection = Date | Date[] | CalendarRange | undefined;

export type CalendarStringRange = {
  from?: string | null;
  to?: string | null;
};

export type CalendarValuePayload = string | string[] | CalendarStringRange | undefined;

export type CalendarDisabledMatcher =
  | ((day: Date) => boolean)
  | Date
  | Date[]
  | undefined
  | null;

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'onChange' | 'onSelect'> {
  mode?: CalendarMode;
  selected?: CalendarSelection;
  onSelect?: (value: CalendarSelection) => void;
  value?: CalendarValuePayload;
  onValueChange?: (value: CalendarValuePayload) => void;
  min?: string | Date;
  max?: string | Date;
  disabled?: CalendarDisabledMatcher;
  showOutsideDays?: boolean;
  numberOfMonths?: number;
  locale?: string;
  firstDayOfWeek?: number;
  isoWeek?: boolean;
  pageBy?: 'single' | 'multi' | 'months';
  initialFocus?: boolean;
  className?: string;
}

const MODE_TO_TAG: Record<CalendarMode, 'calendar-date' | 'calendar-range' | 'calendar-multi'> = {
  single: 'calendar-date',
  range: 'calendar-range',
  multiple: 'calendar-multi',
};

type CalendarElement = HTMLElement & {
  value?: string;
  focus?: (options?: { target?: 'day' | 'next' | 'previous' } & FocusOptions) => void;
  isDateDisallowed?: (day: Date) => boolean;
};

type ForwardedRef = React.Ref<CalendarElement>;

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(value);
      } else {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

type PlainSelection = Date | Date[] | CalendarRange | undefined;

type NormalisedValue = {
  valueString: string;
  payload: CalendarValuePayload;
  selection: PlainSelection;
};

export function dateToIsoString(date: Date | null | undefined): string | undefined {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

export function parseIsoToDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const candidate = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(candidate.getTime())) return undefined;
  return candidate;
}

export function selectionToCallyValue(mode: CalendarMode, selection: PlainSelection): string {
  if (!selection) return '';
  if (mode === 'single') {
    return dateToIsoString(selection as Date | undefined) ?? '';
  }
  if (mode === 'multiple') {
    const dates = Array.isArray(selection) ? selection : [];
    return dates.map((date) => dateToIsoString(date)).filter(Boolean).join(' ');
  }
  const { from, to } = (selection as CalendarRange) ?? {};
  const fromValue = dateToIsoString(from ?? undefined) ?? '';
  const toValue = dateToIsoString(to ?? undefined) ?? '';
  return fromValue + '/' + toValue;
}

export function valuePropToCallyValue(mode: CalendarMode, value: CalendarValuePayload): string {
  if (value === undefined || value === null) return '';
  if (mode === 'single') {
    return typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : normalizeRangeValue(value).from ?? '';
  }
  if (mode === 'multiple') {
    if (Array.isArray(value)) return value.join(' ');
    if (typeof value === 'string') return value;
    return Object.values(normalizeRangeValue(value)).filter(Boolean).join(' ');
  }
  const range = normalizeRangeValue(value);
  return (range.from ?? '') + '/' + (range.to ?? '');
}

export function callyValueToSelection(mode: CalendarMode, value: string): PlainSelection {
  if (!value) return mode === 'multiple' ? [] : undefined;
  if (mode === 'single') {
    return parseIsoToDate(value);
  }
  if (mode === 'multiple') {
    return value
      .trim()
      .split(/\s+/)
      .map((token) => parseIsoToDate(token)!)
      .filter(Boolean);
  }
  const [rawFrom = '', rawTo = ''] = value.split('/');
  const from = parseIsoToDate(rawFrom) ?? null;
  const to = parseIsoToDate(rawTo) ?? null;
  if (!from && !to) return undefined;
  return { from, to };
}

export function callyValueToPayload(mode: CalendarMode, value: string): CalendarValuePayload {
  if (!value) return mode === 'multiple' ? [] : undefined;
  if (mode === 'single') return value;
  if (mode === 'multiple') return value.trim().split(/\s+/).filter(Boolean);
  const [from = '', to = ''] = value.split('/');
  return {
    from: from || null,
    to: to || null,
  } satisfies CalendarStringRange;
}

function normalizeRangeValue(value: CalendarValuePayload): CalendarStringRange {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      from: value.from ?? null,
      to: value.to ?? null,
    };
  }
  return { from: null, to: null };
}

function resolveControlledValue(mode: CalendarMode, selection: PlainSelection, value: CalendarValuePayload): NormalisedValue {
  if (value !== undefined && value !== null) {
    const valueString = valuePropToCallyValue(mode, value);
    return {
      valueString,
      payload: callyValueToPayload(mode, valueString),
      selection: callyValueToSelection(mode, valueString),
    };
  }
  const valueString = selectionToCallyValue(mode, selection);
  return {
    valueString,
    payload: callyValueToPayload(mode, valueString),
    selection,
  };
}

function buildDisabledMatcher(disabled: CalendarDisabledMatcher): ((day: Date) => boolean) | undefined {
  if (!disabled) return undefined;
  if (typeof disabled === 'function') return disabled;
  const items = Array.isArray(disabled) ? disabled : [disabled];
  const isoSet = new Set(items.map((item) => dateToIsoString(item)).filter(Boolean) as string[]);
  if (isoSet.size === 0) return undefined;
  return (day: Date) => {
    const iso = dateToIsoString(day);
    return Boolean(iso && isoSet.has(iso));
  };
}

function toIsoInput(value?: string | Date): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return dateToIsoString(value);
  return value;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'calendar-date': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        min?: string;
        max?: string;
        locale?: string;
        months?: number;
        'show-outside-days'?: boolean;
        'first-day-of-week'?: number;
        'iso-week'?: boolean;
        'page-by'?: string;
      };
      'calendar-range': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        min?: string;
        max?: string;
        locale?: string;
        months?: number;
        'show-outside-days'?: boolean;
        'first-day-of-week'?: number;
        'iso-week'?: boolean;
        'page-by'?: string;
      };
      'calendar-multi': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        min?: string;
        max?: string;
        locale?: string;
        months?: number;
        'show-outside-days'?: boolean;
        'first-day-of-week'?: number;
        'iso-week'?: boolean;
        'page-by'?: string;
      };
      'calendar-month': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        offset?: number;
      };
    }
  }
}

// Export empty object to make this file a module
export {};

function renderMonths(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => 
    React.createElement('calendar-month', { key: index, offset: index })
  );
}

export const Calendar = React.forwardRef<CalendarElement, CalendarProps>(
  (
    {
      mode = 'single',
      selected,
      onSelect,
      value,
      onValueChange,
      disabled,
      min,
      max,
      showOutsideDays = true,
      numberOfMonths = 1,
      locale,
      firstDayOfWeek,
      isoWeek,
      pageBy,
      initialFocus,
      className,
      ...elementProps
    },
    forwardedRef,
  ) => {
    const tag = MODE_TO_TAG[mode] ?? 'calendar-date';
    const calendarRef = React.useRef<CalendarElement>(null);
    const mergedRef = React.useMemo(() => mergeRefs(calendarRef, forwardedRef as ForwardedRef), [forwardedRef]);

    React.useEffect(() => {
      void import('cally');
    }, []);

    const normalised = React.useMemo(() => resolveControlledValue(mode, selected, value), [mode, selected, value]);

    React.useEffect(() => {
      const element = calendarRef.current;
      if (!element) return;
      const nextValue = normalised.valueString ?? '';
      if (element.value !== nextValue) {
        element.value = nextValue;
      }
    }, [normalised.valueString]);

    const disabledMatcher = React.useMemo(() => buildDisabledMatcher(disabled), [disabled]);

    React.useEffect(() => {
      const element = calendarRef.current;
      if (!element) return;
      if (disabledMatcher) {
        element.isDateDisallowed = disabledMatcher;
      } else {
        delete element.isDateDisallowed;
      }
    }, [disabledMatcher]);

    React.useEffect(() => {
      if (!initialFocus) return;
      const element = calendarRef.current;
      if (!element || typeof element.focus !== 'function') return;
      const raf = requestAnimationFrame(() => {
        element.focus({ target: 'day' });
      });
      return () => cancelAnimationFrame(raf);
    }, [initialFocus]);

    React.useEffect(() => {
      const element = calendarRef.current;
      if (!element) return;
      const handleChange = () => {
        const nextValue = element.value ?? '';
        const payload = callyValueToPayload(mode, nextValue);
        const selection = callyValueToSelection(mode, nextValue);
        onValueChange?.(payload);
        onSelect?.(selection);
      };
      element.addEventListener('change', handleChange);
      return () => element.removeEventListener('change', handleChange);
    }, [mode, onSelect, onValueChange]);

    const resolvedFirstDay = firstDayOfWeek ?? (isoWeek ? 1 : undefined);
    const calendarProps: Record<string, unknown> = {
      ref: mergedRef,
      className: cn(DEFAULT_CALENDAR_CLASS, className),
      value: normalised.valueString,
      min: toIsoInput(min),
      max: toIsoInput(max),
      locale,
      months: Math.max(1, numberOfMonths),
      tabIndex: -1,
      ...elementProps,
    };

    if (showOutsideDays !== undefined) {
      calendarProps['show-outside-days'] = showOutsideDays;
    }
    if (resolvedFirstDay !== undefined) {
      calendarProps['first-day-of-week'] = resolvedFirstDay;
    }
    if (isoWeek !== undefined) {
      calendarProps['iso-week'] = isoWeek;
    }
    if (pageBy) {
      calendarProps['page-by'] = pageBy;
    }

    const PreviousIcon = React.createElement('svg', {
      'aria-label': 'Previous month',
      slot: 'previous',
      className: 'size-4 shrink-0 fill-current',
      viewBox: '0 0 24 24',
      role: 'img',
      focusable: 'false',
    }, React.createElement('path', { d: 'M15.75 19.5 8.25 12l7.5-7.5' }));

    const NextIcon = React.createElement('svg', {
      'aria-label': 'Next month',
      slot: 'next',
      className: 'size-4 shrink-0 fill-current',
      viewBox: '0 0 24 24',
      role: 'img',
      focusable: 'false',
    }, React.createElement('path', { d: 'm8.25 4.5 7.5 7.5-7.5 7.5' }));

    return React.createElement(
      tag,
      calendarProps,
      PreviousIcon,
      NextIcon,
      ...renderMonths(numberOfMonths)
    );
  },
);

Calendar.displayName = 'Calendar';

export default Calendar;
