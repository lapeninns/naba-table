'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { AvailabilityScheduleErrorState } from './AvailabilityScheduleStates';
import { AvailabilityScheduleDayCard } from './ScheduleDayCard';
import {
  buildMissingRequiredOccasions,
  buildWeeklyHoursMap,
  canonicalizeRequiredTime,
  extractRequiredOccasionKeys,
  mapWeeklyFromResponse,
  validateServices,
  type DayErrors,
} from '../availabilityScheduleManagerUtils';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { findServicePeriodDriftField, useWorkspaceGbpDriftCheck } from '../gbpDriftBadges';
import {
  buildServicePeriodPayload,
  buildServicePeriodState,
  type DayServiceConfig,
} from '../servicePeriodsMapper';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';
import { DAYS_OF_WEEK } from '../types';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';
import type { ServicePeriodRow } from '@/services/ops/restaurants';

type ServiceWindowsCardProps = {
  restaurantId: string | null;
};

export function ServiceWindowsCard({ restaurantId }: ServiceWindowsCardProps) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const updateServicePeriods = useOpsUpdateServicePeriods(restaurantId);
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();

  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const gbpDrift = useWorkspaceGbpDriftCheck({
    restaurantId,
    sectionKeys: ['servicePeriods'],
  });

  const [dayConfigs, setDayConfigs] = useState<DayServiceConfig[]>([]);
  const [customRows, setCustomRows] = useState<ServicePeriodRow[]>([]);
  const [serviceErrors, setServiceErrors] = useState<DayErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isCreatingOccasions, setIsCreatingOccasions] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const occasionOptions = useMemo(() => occasionsQuery.data ?? [], [occasionsQuery.data]);
  const occasionKeys = useMemo(
    () => extractRequiredOccasionKeys(occasionOptions),
    [occasionOptions],
  );
  const hasRequiredOccasions = Boolean(occasionKeys.lunch && occasionKeys.dinner);

  const initializeState = useCallback(() => {
    if (!operatingHoursQuery.data || !servicePeriodsQuery.data) {
      return;
    }
    const weeklyRows = mapWeeklyFromResponse(operatingHoursQuery.data.weekly);
    const { custom, days } = buildServicePeriodState({
      periods: servicePeriodsQuery.data,
      weeklyHours: buildWeeklyHoursMap(weeklyRows),
      dayLabels: weeklyRows.map((row) => DAYS_OF_WEEK[row.dayOfWeek]),
    });
    setDayConfigs(days);
    setCustomRows(custom);
    setServiceErrors({});
    setIsDirty(false);
    setHasInitialized(true);
  }, [operatingHoursQuery.data, servicePeriodsQuery.data]);

  useEffect(() => {
    if (operatingHoursQuery.data && servicePeriodsQuery.data && !hasInitialized) {
      initializeState();
    }
  }, [operatingHoursQuery.data, servicePeriodsQuery.data, hasInitialized, initializeState]);

  useEffect(() => {
    if (
      operatingHoursQuery.data &&
      servicePeriodsQuery.data &&
      !isDirty &&
      !updateServicePeriods.isPending
    ) {
      initializeState();
    }
  }, [
    operatingHoursQuery.data,
    servicePeriodsQuery.data,
    isDirty,
    updateServicePeriods.isPending,
    initializeState,
  ]);

  const servicePeriodDriftFields = gbpDrift.getFieldsBySection('servicePeriods');

  const availabilityDraftOverrides = useMemo(() => {
    const entries: Array<readonly [string, unknown]> = [];
    for (const day of dayConfigs) {
      if (occasionKeys.lunch && day.lunch.enabled) {
        const field = findServicePeriodDriftField(servicePeriodDriftFields, {
          dayOfWeek: day.dayOfWeek,
          startTime: day.lunch.startTime,
          endTime: day.lunch.endTime,
          bookingOption: occasionKeys.lunch,
          name: day.lunch.name,
        });
        if (field) {
          entries.push([
            field.fieldKey,
            {
              name: day.lunch.name,
              dayOfWeek: day.dayOfWeek,
              startTime: day.lunch.startTime,
              endTime: day.lunch.endTime,
              bookingOption: occasionKeys.lunch,
            },
          ]);
        }
      }
      if (occasionKeys.dinner && day.dinner.enabled) {
        const field = findServicePeriodDriftField(servicePeriodDriftFields, {
          dayOfWeek: day.dayOfWeek,
          startTime: day.dinner.startTime,
          endTime: day.dinner.endTime,
          bookingOption: occasionKeys.dinner,
          name: day.dinner.name,
        });
        if (field) {
          entries.push([
            field.fieldKey,
            {
              name: day.dinner.name,
              dayOfWeek: day.dayOfWeek,
              startTime: day.dinner.startTime,
              endTime: day.dinner.endTime,
              bookingOption: occasionKeys.dinner,
            },
          ]);
        }
      }
    }
    return entries;
  }, [dayConfigs, occasionKeys.dinner, occasionKeys.lunch, servicePeriodDriftFields]);

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    for (const [fieldKey, value] of availabilityDraftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
  }, [availabilityDraftOverrides, registerDriftDraftOverride]);

  useRegisterOpsUnsavedChanges(
    'service-windows',
    isDirty,
    'You have unsaved service window changes. Leave without saving them?',
  );

  const handleMealToggle = (dayIndex: number, mealKey: 'lunch' | 'dinner', value: boolean) => {
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
    setIsDirty(true);
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
    setIsDirty(true);
  };

  const createRequiredOccasions = async () => {
    const missingOccasions = buildMissingRequiredOccasions(occasionKeys);
    if (missingOccasions.length === 0) {
      return;
    }
    try {
      setIsCreatingOccasions(true);
      for (const occasion of missingOccasions) {
        await occasionService.createOccasion({
          key: occasion.key,
          label: occasion.label,
          shortLabel: occasion.shortLabel,
          description: occasion.description,
          availability: [{ kind: 'anytime' }],
          defaultDurationMinutes: occasion.defaultDurationMinutes,
          displayOrder: occasion.displayOrder,
          isActive: true,
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });
      toast.success('Required booking types (Lunch and Dinner) created successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create booking types.');
    } finally {
      setIsCreatingOccasions(false);
    }
  };

  const handleReset = () => {
    initializeState();
  };

  const handleSave = async () => {
    if (!isDirty || updateServicePeriods.isPending) {
      return;
    }

    const { isValid, serviceErrors: nextServiceErrors } = validateServices(dayConfigs);
    setServiceErrors(nextServiceErrors);

    if (!isValid) {
      toast.error('Please fix validation issues in the service windows before saving.');
      return;
    }

    if (!hasRequiredOccasions) {
      toast.error('Create active Lunch and Dinner booking types before saving service windows.');
      return;
    }

    const payload = buildServicePeriodPayload(
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

    try {
      await updateServicePeriods.mutateAsync(payload);
      setIsDirty(false);
      toast.success('Service windows saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save service windows.');
    }
  };

  if (!restaurantId) {
    return null;
  }

  if (
    operatingHoursQuery.isLoading ||
    servicePeriodsQuery.isLoading ||
    occasionsQuery.isLoading ||
    !hasInitialized
  ) {
    return (
      <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')}>
        <CardHeader className={cn(SETTINGS_COMPACT_CARD_HEADER_CLASS, 'pb-3')}>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const loadError = operatingHoursQuery.error ?? servicePeriodsQuery.error ?? occasionsQuery.error;
  if (loadError) {
    return <AvailabilityScheduleErrorState message={loadError.message} />;
  }

  return (
    <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')} id="service-windows">
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            Weekly schedule
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">Meal windows (Lunch / Dinner)</CardTitle>
            <CardDescription className="max-w-3xl">
              Configure independent Lunch and Dinner reservation sessions inside open boundaries.
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <Badge variant="metric" className="h-8 px-3">
              Unsaved changes in this section
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
        {!hasRequiredOccasions ? (
          <Alert variant="warning">
            <AlertCircle className="size-4" />
            <AlertTitle>Lunch and dinner booking types are required</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>
                  To manage meal reservation windows, you must first initialize Lunch and Dinner
                  occasions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void createRequiredOccasions()}
                  disabled={isCreatingOccasions}
                >
                  Create missing lunch and dinner booking types
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {dayConfigs.map((day, index) => {
          const row = mapWeeklyFromResponse(operatingHoursQuery.data!.weekly)[index];
          const serviceFields: DualSyncFieldSummary[] = [];
          if (occasionKeys.lunch && day.lunch.enabled) {
            const field = findServicePeriodDriftField(servicePeriodDriftFields, {
              dayOfWeek: day.dayOfWeek,
              startTime: day.lunch.startTime,
              endTime: day.lunch.endTime,
              bookingOption: occasionKeys.lunch,
              name: day.lunch.name,
            });
            if (field) serviceFields.push(field);
          }
          if (occasionKeys.dinner && day.dinner.enabled) {
            const field = findServicePeriodDriftField(servicePeriodDriftFields, {
              dayOfWeek: day.dayOfWeek,
              startTime: day.dinner.startTime,
              endTime: day.dinner.endTime,
              bookingOption: occasionKeys.dinner,
              name: day.dinner.name,
            });
            if (field) serviceFields.push(field);
          }

          return (
            <AvailabilityScheduleDayCard
              key={day.dayOfWeek}
              day={day}
              dayError={serviceErrors[day.dayOfWeek]}
              hasRequiredOccasions={hasRequiredOccasions}
              onMealTimeChange={handleMealTimeChange}
              onMealToggle={handleMealToggle}
              onWeeklyChange={() => {}}
              row={row}
              rowErrors={undefined}
              weeklyDriftField={null}
              serviceDriftFields={serviceFields}
              showWeeklyHours={false}
            />
          );
        })}
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('service-windows')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={updateServicePeriods.isPending || !isDirty}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || updateServicePeriods.isPending}
          >
            <Save data-icon="inline-start" aria-hidden />
            Save windows
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
