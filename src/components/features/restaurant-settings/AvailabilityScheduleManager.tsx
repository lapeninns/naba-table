'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock3, RotateCcw, Save, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOccasionService } from '@/contexts/ops-services';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import {
  useOpsOperatingHours,
  useOpsUpdateOperatingHours,
} from '@/hooks/ops/useOpsOperatingHours';
import {
  useOpsServicePeriods,
  useOpsUpdateServicePeriods,
} from '@/hooks/ops/useOpsServicePeriods';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';

import { AvailabilityOccasionsEditor } from './AvailabilityOccasionsEditor';
import { AvailabilityOverridesEditor } from './AvailabilityOverridesEditor';
import { AvailabilityScheduleDayCard } from './AvailabilityScheduleDayCard';
import {
  buildOperatingHoursPayload,
  buildWeeklyHoursMap,
  canonicalizeRequiredTime,
  defaultOverrideRow,
  defaultWeeklyRows,
  extractRequiredOccasionKeys,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
  type DayErrors,
  validateHours,
  validateServices,
} from './availabilityScheduleManagerUtils';
import { buildServicePeriodPayload, buildServicePeriodState, type DayServiceConfig } from './servicePeriodsMapper';
import { type OverrideErrors, type OverrideRow, type WeeklyErrors, type WeeklyRow } from './types';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { ServicePeriodRow } from '@/services/ops/restaurants';

type AvailabilityScheduleManagerProps = {
  restaurantId: string | null;
};

type SaveState =
  | {
      variant: 'destructive' | 'success' | 'warning';
      title: string;
      message: string;
    }
  | null;

export function AvailabilityScheduleManager({
  restaurantId,
}: AvailabilityScheduleManagerProps) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);
  const updateServicePeriods = useOpsUpdateServicePeriods(restaurantId);
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(defaultWeeklyRows);
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [dayConfigs, setDayConfigs] = useState<DayServiceConfig[]>([]);
  const [customRows, setCustomRows] = useState<ServicePeriodRow[]>([]);
  const [occasionDrafts, setOccasionDrafts] = useState<OpsOccasion[]>([]);
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);
  const [serviceErrors, setServiceErrors] = useState<DayErrors>({});
  const [hoursDirty, setHoursDirty] = useState(false);
  const [servicesDirty, setServicesDirty] = useState(false);
  const [occasionsDirty, setOccasionsDirty] = useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const occasionOptions = useMemo(() => occasionsQuery.data ?? [], [occasionsQuery.data]);
  const occasionKeys = useMemo(
    () => extractRequiredOccasionKeys(occasionOptions),
    [occasionOptions],
  );

  const initializeState = useCallback(() => {
    if (!operatingHoursQuery.data || !servicePeriodsQuery.data || !occasionsQuery.data) {
      return;
    }
    const nextWeeklyRows = mapWeeklyFromResponse(operatingHoursQuery.data.weekly);
    const { custom, days } = buildServicePeriodState({
      periods: servicePeriodsQuery.data,
      weeklyHours: buildWeeklyHoursMap(nextWeeklyRows),
      dayLabels: nextWeeklyRows.map((row) => row.dayOfWeek).map((dayOfWeek) =>
        ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      ),
    });

    setWeeklyRows(nextWeeklyRows);
    setOverrideRows(mapOverridesFromResponse(operatingHoursQuery.data.overrides));
    setDayConfigs(days);
    setCustomRows(custom);
    setOccasionDrafts(occasionsQuery.data);
    setWeeklyErrors({});
    setOverrideErrors([]);
    setServiceErrors({});
    setHoursDirty(false);
    setServicesDirty(false);
    setOccasionsDirty(false);
    setSaveState(null);
    setHasInitialized(true);
  }, [occasionsQuery.data, operatingHoursQuery.data, servicePeriodsQuery.data]);

  const isSaving =
    isSavingConfiguration || updateOperatingHours.isPending || updateServicePeriods.isPending;
  const hasLocalChanges = hoursDirty || servicesDirty || occasionsDirty;
  const hasRequiredOccasions = Boolean(occasionKeys.lunch && occasionKeys.dinner);

  useEffect(() => {
    if (!operatingHoursQuery.data || !servicePeriodsQuery.data || !occasionsQuery.data) {
      return;
    }
    if (!hasInitialized || (!hasLocalChanges && !isSaving)) {
      initializeState();
    }
  }, [
    hasInitialized,
    hasLocalChanges,
    initializeState,
    isSaving,
    operatingHoursQuery.data,
    occasionsQuery.data,
    servicePeriodsQuery.data,
  ]);

  const clearSaveState = () => setSaveState(null);

  const handleWeeklyChange = useCallback((dayIndex: number, patch: Partial<WeeklyRow>) => {
    setWeeklyRows((current) =>
      current.map((row, index) => (index === dayIndex ? { ...row, ...patch } : row)),
    );
    setDayConfigs((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) {
          return day;
        }
        const nextClosed = patch.isClosed ?? day.isClosed;
        return {
          ...day,
          opensAt: patch.opensAt !== undefined ? patch.opensAt : day.opensAt,
          closesAt: patch.closesAt !== undefined ? patch.closesAt : day.closesAt,
          isClosed: nextClosed,
          lunch: nextClosed ? { ...day.lunch, enabled: false } : day.lunch,
          dinner: nextClosed ? { ...day.dinner, enabled: false } : day.dinner,
        };
      }),
    );
    setWeeklyErrors((prev) => {
      const next = { ...prev };
      delete next[dayIndex];
      return next;
    });
    setServiceErrors((prev) => {
      const next = { ...prev };
      delete next[dayIndex];
      return next;
    });
    setHoursDirty(true);
    clearSaveState();
  }, []);

  const handleOverrideChange = useCallback((index: number, patch: Partial<OverrideRow>) => {
    setOverrideRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    setOverrideErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
    setHoursDirty(true);
    clearSaveState();
  }, []);

  const addOverride = () => {
    setOverrideRows((current) => [...current, defaultOverrideRow()]);
    setOverrideErrors((current) => [...current, {}]);
    setHoursDirty(true);
    clearSaveState();
  };

  const removeOverride = (index: number) => {
    setOverrideRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setOverrideErrors((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setHoursDirty(true);
    clearSaveState();
  };

  const handleMealToggle = (
    dayIndex: number,
    mealKey: 'lunch' | 'dinner',
    value: boolean,
  ) => {
    setDayConfigs((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              [mealKey]: {
                ...day[mealKey],
                enabled: value,
              },
            }
          : day,
      ),
    );
    setServiceErrors((prev) => {
      const next = { ...prev };
      const dayError = { ...(next[dayIndex] ?? {}) };
      delete dayError[mealKey];
      if (Object.keys(dayError).length === 0) {
        delete next[dayIndex];
      } else {
        next[dayIndex] = dayError;
      }
      return next;
    });
    setServicesDirty(true);
    clearSaveState();
  };

  const handleMealTimeChange = (
    dayIndex: number,
    mealKey: 'lunch' | 'dinner',
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setDayConfigs((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              [mealKey]: {
                ...day[mealKey],
                [field]: value,
              },
            }
          : day,
      ),
    );
    setServiceErrors((prev) => {
      const next = { ...prev };
      const dayError = { ...(next[dayIndex] ?? {}) };
      if (dayError[mealKey]) {
        const nextMealError = { ...dayError[mealKey] };
        delete nextMealError[field === 'startTime' ? 'start' : 'end'];
        if (Object.keys(nextMealError).length === 0) {
          delete dayError[mealKey];
        } else {
          dayError[mealKey] = nextMealError;
        }
      }
      if (Object.keys(dayError).length === 0) {
        delete next[dayIndex];
      } else {
        next[dayIndex] = dayError;
      }
      return next;
    });
    setServicesDirty(true);
    clearSaveState();
  };

  const handleSave = async () => {
    if (!hoursDirty && !servicesDirty && !occasionsDirty) {
      return;
    }

    const hourValidation = validateHours(weeklyRows, overrideRows);
    const serviceValidation = validateServices(dayConfigs);

    setWeeklyErrors(hourValidation.weeklyErrors);
    setOverrideErrors(hourValidation.overrideErrors);
    setServiceErrors(serviceValidation.serviceErrors);

    if (!hourValidation.isValid || !serviceValidation.isValid) {
      setSaveState({
        variant: 'destructive',
        title: 'Review highlighted fields',
        message: 'Fix validation issues in the schedule or overrides before saving.',
      });
      return;
    }

    if (servicesDirty && !hasRequiredOccasions) {
      setSaveState({
        variant: 'destructive',
        title: 'Missing booking occasions',
        message: 'Create active Lunch and Dinner occasions before saving service windows.',
      });
      return;
    }

    const operatingHoursPayload = buildOperatingHoursPayload(weeklyRows, overrideRows);
    const servicePayload = buildServicePeriodPayload(
      dayConfigs.map((day) =>
        day.isClosed
          ? {
              ...day,
              lunch: { ...day.lunch, enabled: false },
              dinner: { ...day.dinner, enabled: false },
            }
          : day,
      ),
      {
        customRows,
        canonicalizeTime: canonicalizeRequiredTime,
        occasionKeys: {
          lunch: occasionKeys.lunch!,
          dinner: occasionKeys.dinner!,
        },
      },
    );

    let hoursSaved = false;

    try {
      setIsSavingConfiguration(true);
      if (hoursDirty) {
        await updateOperatingHours.mutateAsync(operatingHoursPayload);
        hoursSaved = true;
        setHoursDirty(false);
      }

      if (servicesDirty) {
        await updateServicePeriods.mutateAsync(servicePayload);
        setServicesDirty(false);
      }

      if (occasionsDirty) {
        const originalOccasions = occasionsQuery.data ?? [];
        const originalByKey = new Map(originalOccasions.map((occasion) => [occasion.key, occasion]));
        const nextByKey = new Map(occasionDrafts.map((occasion) => [occasion.key, occasion]));

        for (const occasion of occasionDrafts) {
          const original = originalByKey.get(occasion.key);
          if (!original) {
            await occasionService.createOccasion({
              key: occasion.key,
              label: occasion.label,
              shortLabel: occasion.shortLabel,
              description: occasion.description ?? null,
              availability: occasion.availability,
              defaultDurationMinutes: occasion.defaultDurationMinutes,
              displayOrder: occasion.displayOrder,
              isActive: occasion.isActive,
            });
            continue;
          }

          const changed =
            original.label !== occasion.label ||
            original.shortLabel !== occasion.shortLabel ||
            (original.description ?? null) !== (occasion.description ?? null) ||
            JSON.stringify(original.availability ?? []) !==
              JSON.stringify(occasion.availability ?? []) ||
            original.defaultDurationMinutes !== occasion.defaultDurationMinutes ||
            original.displayOrder !== occasion.displayOrder ||
            original.isActive !== occasion.isActive;

          if (changed) {
            await occasionService.updateOccasion(occasion.key, {
              label: occasion.label,
              shortLabel: occasion.shortLabel,
              description: occasion.description ?? null,
              availability: occasion.availability,
              defaultDurationMinutes: occasion.defaultDurationMinutes,
              displayOrder: occasion.displayOrder,
              isActive: occasion.isActive,
            });
          }
        }

        for (const original of originalOccasions) {
          if (!nextByKey.has(original.key) && !original.isBuiltin) {
            await occasionService.deleteOccasion(original.key);
          }
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });
        setOccasionsDirty(false);
      }

      setSaveState({
        variant: 'success',
        title: 'Availability updated',
        message: 'The weekly schedule, service windows, overrides, and occasions are now saved.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setSaveState(
        hoursSaved
          ? {
              variant: 'warning',
              title: 'Partial save completed',
              message: `Some availability changes were saved, but another section still needs attention: ${message}`,
            }
          : {
              variant: 'destructive',
              title: 'Unable to save availability',
              message,
            },
      );
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  const handleReset = () => {
    initializeState();
  };

  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled:
        !isSaving &&
        (hoursDirty || servicesDirty) &&
        (!servicesDirty || hasRequiredOccasions),
      when: () => true,
      handler: () => {
        void handleSave();
      },
    },
  ]);

  if (!restaurantId) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>Select a restaurant to manage availability.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const loadError =
    operatingHoursQuery.error ?? servicePeriodsQuery.error ?? occasionsQuery.error ?? null;

  if (loadError) {
    const message =
      loadError instanceof Error ? loadError.message : 'Unable to load availability settings.';
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>Unable to load the unified availability editor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Availability editor unavailable</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (
    operatingHoursQuery.isLoading ||
    servicePeriodsQuery.isLoading ||
    occasionsQuery.isLoading ||
    !hasInitialized
  ) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <Badge variant="outline" className="w-fit">
            Weekly schedule
          </Badge>
          <CardTitle className="text-xl">Operating hours and service windows together</CardTitle>
          <CardDescription>Loading the integrated availability editor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const canSave =
    !isSaving &&
    (hoursDirty || servicesDirty || occasionsDirty) &&
    (!servicesDirty || hasRequiredOccasions);

  return (
    <Card className="overflow-hidden border-border/70" id="availability-schedule">
      <CardHeader className="gap-4 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit">
            Weekly schedule
          </Badge>
          <div className="space-y-1">
            <CardTitle className="text-xl">Operating hours and service windows together</CardTitle>
            <CardDescription className="max-w-3xl">
              Edit the outer open-close window, the nested lunch and dinner windows, and special
              date overrides from one working surface.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hoursDirty || servicesDirty ? (
            <Badge variant="metric" className="h-8 px-3">
              Unsaved changes
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-6">
        <div id="availability-hours" className="scroll-mt-28" />
        <div id="service-periods" className="scroll-mt-28" />
        {saveState ? (
          <Alert variant={saveState.variant}>
            <AlertCircle className="size-4" />
            <AlertTitle>{saveState.title}</AlertTitle>
            <AlertDescription>{saveState.message}</AlertDescription>
          </Alert>
        ) : null}

        {!hasRequiredOccasions ? (
          <Alert variant="warning">
            <AlertCircle className="size-4" />
            <AlertTitle>Lunch and dinner occasions are required</AlertTitle>
            <AlertDescription>
              Operating hours can still be edited here, but service-window saves need active
              `Lunch` and `Dinner` booking occasions.
            </AlertDescription>
          </Alert>
        ) : null}

        {customRows.length > 0 ? (
          <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Additional service periods are preserved</AlertTitle>
            <AlertDescription>
              {customRows.length} custom service period{customRows.length === 1 ? '' : 's'} sit
              outside the lunch-dinner layout. They will be preserved unchanged by this command
              center.
            </AlertDescription>
          </Alert>
        ) : null}

        <Alert>
          <Clock3 className="size-4" />
          <AlertTitle>How this command center works</AlertTitle>
          <AlertDescription>
            This page owns the day-to-day availability workflow. Weekly hours, service windows,
            overrides, and booking occasions now live in one editable surface with one save action.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto p-1 sm:w-fit">
            <TabsTrigger value="schedule">Weekly schedule</TabsTrigger>
            <TabsTrigger value="overrides">Date overrides</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-0 space-y-4">
            {weeklyRows.map((row, index) => (
              <AvailabilityScheduleDayCard
                key={row.dayOfWeek}
                day={dayConfigs[index]}
                dayError={serviceErrors[row.dayOfWeek]}
                hasRequiredOccasions={hasRequiredOccasions}
                onMealTimeChange={handleMealTimeChange}
                onMealToggle={handleMealToggle}
                onWeeklyChange={handleWeeklyChange}
                row={row}
                rowErrors={weeklyErrors[row.dayOfWeek]}
              />
            ))}
          </TabsContent>

          <TabsContent value="overrides" className="mt-0">
            <AvailabilityOverridesEditor
              onAdd={addOverride}
              onChange={handleOverrideChange}
              onRemove={removeOverride}
              rowErrors={overrideErrors}
              rows={overrideRows}
            />
          </TabsContent>
        </Tabs>

        <AvailabilityOccasionsEditor
          occasions={occasionDrafts}
          onChange={(next) => {
            setOccasionDrafts(next);
            setOccasionsDirty(true);
            clearSaveState();
          }}
        />
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
        <div className="text-sm text-muted-foreground">
          Save once to persist the full availability workflow: weekly hours, service windows, date
          overrides, and booking occasions.
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || !hasLocalChanges}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save className="size-4" />
            Save configuration
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
