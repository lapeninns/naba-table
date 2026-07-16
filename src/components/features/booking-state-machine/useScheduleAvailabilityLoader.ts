import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { formatDateForInput } from '@reserve/shared/formatting/booking';

import {
  buildMonthDateKeys,
  buildMonthPrefetchTargets,
  calendarMaskQueryKey,
  deriveMaskAvailability,
  deriveScheduleUnavailability,
  fetchCalendarMask,
  fetchReservationSchedule,
  mergeWithSyntheticSlots,
  MONTH_KEY_FORMATTER,
  scheduleQueryKey,
  type CalendarMask,
  type ScheduleRecord,
  type UnavailabilityReason,
} from './scheduleAwareTimestampPickerDomain';

type UseScheduleAvailabilityLoaderOptions = {
  activeDate: string;
  normalizedMinDate: Date;
  normalizedMinTimestamp: number;
  restaurantSlug: string | null | undefined;
};

export function useScheduleAvailabilityLoader({
  activeDate,
  normalizedMinDate,
  normalizedMinTimestamp,
  restaurantSlug,
}: UseScheduleAvailabilityLoaderOptions) {
  const queryClient = useQueryClient();
  const [scheduleStateByDate, setScheduleStateByDate] = useState<Map<string, ScheduleRecord>>(
    () => new Map(),
  );
  const scheduleStateRef = useRef(scheduleStateByDate);
  const maskPrefetchedMonthsRef = useRef<Set<string>>(new Set());
  const [unavailableDates, setUnavailableDates] = useState<Map<string, UnavailabilityReason>>(
    () => new Map(),
  );
  const [loadingDates, setLoadingDates] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    scheduleStateRef.current = scheduleStateByDate;
  }, [scheduleStateByDate]);

  const updateUnavailableDate = useCallback(
    (dateKey: string, reason: UnavailabilityReason | null) => {
      setUnavailableDates((prev) => {
        const existing = prev.get(dateKey) ?? null;
        if (existing === reason) {
          return prev;
        }
        const next = new Map(prev);
        if (reason) {
          next.set(dateKey, reason);
        } else {
          next.delete(dateKey);
        }
        return next;
      });
    },
    [],
  );

  const applyCalendarMask = useCallback(
    (mask: CalendarMask) => {
      const derived = deriveMaskAvailability(mask, normalizedMinTimestamp);
      if (derived.size === 0) {
        return;
      }
      setUnavailableDates((prev) => {
        const next = new Map(prev);
        derived.forEach((reason, key) => {
          if (reason) {
            next.set(key, reason);
          } else {
            next.delete(key);
          }
        });
        return next;
      });
    },
    [normalizedMinTimestamp],
  );

  const prefetchCalendarMask = useCallback(
    (monthStart: Date) => {
      const slug = restaurantSlug?.trim();
      if (!slug) {
        return;
      }
      const monthKey = MONTH_KEY_FORMATTER(monthStart);
      if (maskPrefetchedMonthsRef.current.has(monthKey)) {
        return;
      }
      maskPrefetchedMonthsRef.current.add(monthKey);

      const rangeStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      const rangeEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const fromKey = formatDateForInput(rangeStart);
      const toKey = formatDateForInput(rangeEnd);
      const monthDateKeys = buildMonthDateKeys(monthStart, normalizedMinDate);

      setLoadingDates((prev) => {
        const next = new Set(prev);
        monthDateKeys.forEach((key) => next.add(key));
        return next;
      });

      void queryClient
        .fetchQuery({
          queryKey: calendarMaskQueryKey(slug, fromKey, toKey),
          queryFn: ({ signal }) => fetchCalendarMask(slug, fromKey, toKey, signal),
          staleTime: 5 * 60_000,
          meta: { persist: false },
        })
        .then((mask) => {
          applyCalendarMask(mask);
        })
        .catch((error) => {
          maskPrefetchedMonthsRef.current.delete(monthKey);
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[schedule-picker] failed to fetch calendar mask', {
              restaurantSlug: slug,
              from: fromKey,
              to: toKey,
              error,
            });
          }
        })
        .finally(() => {
          setLoadingDates((prev) => {
            const next = new Set(prev);
            monthDateKeys.forEach((key) => next.delete(key));
            return next;
          });
        });
    },
    [applyCalendarMask, normalizedMinDate, queryClient, restaurantSlug],
  );

  const prefetchVisibleMonths = useCallback(
    (month: Date) => {
      buildMonthPrefetchTargets(month, normalizedMinTimestamp).forEach(prefetchCalendarMask);
    },
    [normalizedMinTimestamp, prefetchCalendarMask],
  );

  const loadSchedule = useCallback(
    async (dateKey: string, opts?: { prefetched?: boolean }) => {
      const slug = restaurantSlug?.trim();
      if (!slug || !dateKey) {
        return null;
      }

      const existing = scheduleStateRef.current.get(dateKey);
      if (!opts?.prefetched && existing?.status === 'loading') {
        return existing.schedule;
      }
      if (!opts?.prefetched && existing?.status === 'success') {
        return existing.schedule;
      }

      if (!opts?.prefetched) {
        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          const current = next.get(dateKey);
          next.set(dateKey, {
            status: 'loading',
            schedule: current?.schedule ?? null,
            error: null,
          });
          return next;
        });
      }

      try {
        const schedule = await queryClient.fetchQuery({
          queryKey: scheduleQueryKey(slug, dateKey),
          queryFn: ({ signal }) => fetchReservationSchedule(slug, dateKey, { signal }),
          staleTime: 60_000,
          meta: { persist: false },
        });
        const enriched = mergeWithSyntheticSlots(schedule);

        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          next.set(dateKey, {
            status: 'success',
            schedule: enriched,
            error: null,
          });
          return next;
        });
        const derivedReason = deriveScheduleUnavailability(enriched);
        updateUnavailableDate(dateKey, derivedReason);
        return enriched;
      } catch (error) {
        console.error(
          '[schedule-picker] failed to load schedule',
          error instanceof Error ? error.message : String(error),
        );
        setScheduleStateByDate((prev) => {
          const next = new Map(prev);
          next.set(dateKey, {
            status: 'error',
            schedule: null,
            error: 'Unable to load availability for this date. Please try again.',
          });
          return next;
        });
        updateUnavailableDate(dateKey, 'unknown');
        return null;
      }
    },
    [queryClient, restaurantSlug, updateUnavailableDate],
  );

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    void loadSchedule(activeDate);
  }, [activeDate, loadSchedule]);

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    const parsed = DateTime.fromISO(activeDate, { zone: 'utc' });
    if (parsed.isValid) {
      const monthStart = new Date(parsed.year, parsed.month - 1, 1);
      prefetchVisibleMonths(monthStart);
    }
  }, [activeDate, prefetchVisibleMonths]);

  const activeRecord = activeDate ? (scheduleStateByDate.get(activeDate) ?? null) : null;
  const activeRecordStatus = activeRecord?.status ?? 'idle';
  const currentSchedule = activeRecord?.schedule ?? null;

  const unavailabilityReason = useMemo<UnavailabilityReason | null>(() => {
    if (!activeDate) {
      return null;
    }
    const reasonFromMask = unavailableDates.get(activeDate);
    if (reasonFromMask) {
      return reasonFromMask;
    }
    if (activeRecordStatus === 'success') {
      return deriveScheduleUnavailability(currentSchedule);
    }
    return null;
  }, [activeDate, activeRecordStatus, currentSchedule, unavailableDates]);

  const getScheduleForDate = useCallback((dateKey: string) => {
    return scheduleStateRef.current.get(dateKey)?.schedule ?? null;
  }, []);

  const resetScheduleAvailability = useCallback(() => {
    const emptyState = new Map<string, ScheduleRecord>();
    scheduleStateRef.current = emptyState;
    setScheduleStateByDate(emptyState);
    maskPrefetchedMonthsRef.current.clear();
    setUnavailableDates(new Map());
    setLoadingDates(new Set());
  }, []);

  const handleMonthPrefetch = useCallback(
    (month: Date) => {
      const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
      prefetchVisibleMonths(firstDay);
    },
    [prefetchVisibleMonths],
  );

  return {
    activeRecordStatus,
    currentSchedule,
    getScheduleForDate,
    handleMonthPrefetch,
    loadingDates,
    resetScheduleAvailability,
    unavailableDates,
    unavailabilityReason,
  };
}
