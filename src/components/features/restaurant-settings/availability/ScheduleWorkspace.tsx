import { Clock3 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import { AvailabilityOverridesEditor } from '../AvailabilityOverridesEditor';
import { GbpDriftBadge } from '../gbpDriftBadges';
import { SETTINGS_COMPACT_STATUS_ROW_CLASS } from '../shared';
import { AvailabilityScheduleDayCard } from './ScheduleDayCard';
import { buildServiceWindowDriftFieldsForDay } from './serviceWindowsCardDomain';

import type { DayErrors } from '../availabilityScheduleValidation';
import type { DayServiceConfig } from '../servicePeriodsMapper';
import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from '../types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type MealKey = 'lunch' | 'dinner';

type ScheduleWorkspaceProps = {
  weeklyRows: WeeklyRow[];
  dayConfigs: DayServiceConfig[];
  weeklyErrors: WeeklyErrors;
  overrideErrors: OverrideErrors;
  serviceErrors: DayErrors;
  overrideRows: OverrideRow[];
  hasRequiredOccasions: boolean;
  occasionKeys: { lunch?: string | null; dinner?: string | null };
  operatingHoursDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  servicePeriodDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  getWeeklyDriftField: (fieldKey: string) => DualSyncFieldSummary | null;
  onWeeklyChange: (dayIndex: number, patch: Partial<WeeklyRow>) => void;
  onMealToggle: (dayIndex: number, mealKey: MealKey, value: boolean) => void;
  onMealTimeChange: (
    dayIndex: number,
    mealKey: MealKey,
    field: 'startTime' | 'endTime',
    value: string,
  ) => void;
  onOverrideChange: (index: number, patch: Partial<OverrideRow>) => void;
  onAddOverride: () => void;
  onRemoveOverride: (index: number) => void;
  customRowsCount: number;
};

export function ScheduleWorkspace({
  weeklyRows,
  dayConfigs,
  weeklyErrors,
  overrideErrors,
  serviceErrors,
  overrideRows,
  hasRequiredOccasions,
  occasionKeys,
  operatingHoursDriftFields,
  servicePeriodDriftFields,
  getWeeklyDriftField,
  onWeeklyChange,
  onMealToggle,
  onMealTimeChange,
  onOverrideChange,
  onAddOverride,
  onRemoveOverride,
  customRowsCount,
}: ScheduleWorkspaceProps) {
  return (
    <>
      <Alert>
        <Clock3 className="size-4" />
        <AlertTitle>Availability save scope</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              Weekly hours, service windows, date overrides, and booking types save together from
              this workspace.
            </li>
            {customRowsCount > 0 ? (
              <li>
                {customRowsCount} custom service period{customRowsCount === 1 ? '' : 's'} sit
                outside the lunch-dinner layout and will be preserved unchanged.
              </li>
            ) : null}
          </ul>
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="schedule" className="flex flex-col gap-4">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto p-1 sm:w-fit">
          <TabsTrigger value="schedule">Weekly schedule</TabsTrigger>
          <TabsTrigger value="overrides">Date overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-0 flex flex-col gap-4">
          <div id={AVAILABILITY_ANCHORS.weeklyHours} className="scroll-mt-28">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Weekly open hours</p>
              <GbpDriftBadge fields={operatingHoursDriftFields} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Set the outer open and close window for each day.
            </p>
          </div>
          <div
            className={cn(
              SETTINGS_COMPACT_STATUS_ROW_CLASS,
              'justify-between rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2',
            )}
          >
            <span>
              Turn times per party size are set on each booking occasion — including{' '}
              <span className="font-medium text-foreground">Lunch</span> and{' '}
              <span className="font-medium text-foreground">Dinner</span>.
            </span>
          </div>
          <div id={AVAILABILITY_ANCHORS.serviceWindows} className="scroll-mt-28">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Meal windows (lunch / dinner inside open hours)
              </p>
              <GbpDriftBadge fields={servicePeriodDriftFields} />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Use each day card to switch lunch and dinner windows on or off inside the open hours.
            </p>
          </div>
          {weeklyRows.map((row, index) => {
            const day = dayConfigs[index];
            const serviceFields = day
              ? buildServiceWindowDriftFieldsForDay({
                  day,
                  occasionKeys,
                  servicePeriodDriftFields,
                })
              : [];

            return (
              <AvailabilityScheduleDayCard
                key={row.dayOfWeek}
                day={day}
                dayError={serviceErrors[row.dayOfWeek]}
                hasRequiredOccasions={hasRequiredOccasions}
                onMealTimeChange={onMealTimeChange}
                onMealToggle={onMealToggle}
                onWeeklyChange={onWeeklyChange}
                row={row}
                rowErrors={weeklyErrors[row.dayOfWeek]}
                weeklyDriftField={getWeeklyDriftField(`operatingHours.weekly.${row.dayOfWeek}`)}
                serviceDriftFields={serviceFields}
              />
            );
          })}
        </TabsContent>

        <TabsContent value="overrides" className="mt-0">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Date overrides</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Closures and special hours override the weekly template.
            </p>
          </div>
          <AvailabilityOverridesEditor
            onAdd={onAddOverride}
            onChange={onOverrideChange}
            onRemove={onRemoveOverride}
            rowErrors={overrideErrors}
            rows={overrideRows}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
