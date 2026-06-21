'use client';

import { motion, AnimatePresence } from 'motion/react';

import { cn } from '@/lib/utils';

import { type DayServiceConfig } from '../servicePeriodsMapper';
import { type WeeklyErrors, type WeeklyRow } from '../types';
import {
  buildScheduleDayCardViewModel,
  buildScheduleDayMealEditorState,
} from './scheduleDayCardDomain';
import { ScheduleDayCardHeader } from './ScheduleDayCardHeader';
import { ScheduleDayClosedNotice } from './ScheduleDayClosedNotice';
import { ScheduleDayServiceWindowsSection } from './ScheduleDayServiceWindowsSection';
import { ScheduleDayWeeklyFields } from './ScheduleDayWeeklyFields';

import type { DayErrors } from '../availabilityScheduleValidation';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type AvailabilityScheduleDayCardProps = {
  day: DayServiceConfig | undefined;
  dayError: DayErrors[number] | undefined;
  hasRequiredOccasions: boolean;
  onMealTimeChange: (
    dayIndex: number,
    mealKey: 'lunch' | 'dinner',
    field: 'startTime' | 'endTime',
    value: string,
  ) => void;
  onMealToggle: (dayIndex: number, mealKey: 'lunch' | 'dinner', value: boolean) => void;
  onWeeklyChange: (index: number, patch: Partial<WeeklyRow>) => void;
  row: WeeklyRow;
  rowErrors: WeeklyErrors[number] | undefined;
  weeklyDriftField?: DualSyncFieldSummary | null;
  serviceDriftFields?: ReadonlyArray<DualSyncFieldSummary>;
  showWeeklyHours?: boolean;
  showServiceWindows?: boolean;
};

export function AvailabilityScheduleDayCard({
  day,
  dayError,
  hasRequiredOccasions,
  onMealTimeChange,
  onMealToggle,
  onWeeklyChange,
  row,
  rowErrors,
  weeklyDriftField = null,
  serviceDriftFields = [],
  showWeeklyHours = true,
  showServiceWindows = true,
}: AvailabilityScheduleDayCardProps) {
  const { dayLabel, isClosed } = buildScheduleDayCardViewModel({ day, row });
  const lunchEditor = buildScheduleDayMealEditorState({
    day,
    dayError,
    hasRequiredOccasions,
    mealKey: 'lunch',
  });
  const dinnerEditor = buildScheduleDayMealEditorState({
    day,
    dayError,
    hasRequiredOccasions,
    mealKey: 'dinner',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'rounded-xl border transition-all duration-300 p-5 relative overflow-hidden',
        isClosed
          ? 'border-muted-foreground/10 bg-muted/[0.08] shadow-inner opacity-95'
          : 'border-primary/10 backdrop-blur-sm bg-card/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(99,102,241,0.03)] hover:border-primary/20',
      )}
    >
      {/* Decorative vertical HSL accent glow strip on the side */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 transition-all duration-300',
          isClosed
            ? 'bg-muted-foreground/20'
            : 'bg-gradient-to-b from-primary to-primary/85 shadow-[2px_0_10px_rgba(99,102,241,0.3)]',
        )}
      />

      <ScheduleDayCardHeader
        dayLabel={dayLabel}
        isClosed={isClosed}
        onWeeklyChange={onWeeklyChange}
        row={row}
        serviceDriftFields={serviceDriftFields}
        weeklyDriftField={weeklyDriftField}
      />

      <AnimatePresence mode="wait">
        {isClosed ? (
          <motion.div
            key="closed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-5 pl-2"
          >
            <ScheduleDayClosedNotice />
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5 space-y-5 pl-2"
          >
            {showWeeklyHours && (
              <ScheduleDayWeeklyFields
                onWeeklyChange={onWeeklyChange}
                row={row}
                rowErrors={rowErrors}
              />
            )}

            {showServiceWindows && (
              <ScheduleDayServiceWindowsSection
                dayOfWeek={row.dayOfWeek}
                dinnerEditor={dinnerEditor}
                lunchEditor={lunchEditor}
                onMealTimeChange={onMealTimeChange}
                onMealToggle={onMealToggle}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
