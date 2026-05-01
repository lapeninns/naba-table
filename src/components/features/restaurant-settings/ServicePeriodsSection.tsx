'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsGoogleBusinessProfileConnection } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import {
  useOpsServicePeriods,
  useOpsSyncServicePeriodsWithGoogleBusinessProfile,
  useOpsUpdateServicePeriods,
} from '@/hooks/ops/useOpsServicePeriods';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { cn } from '@/lib/utils';

import {
  buildWeeklyHoursMap,
  canonicalizeRequiredTime,
  extractRequiredOccasionKeys,
  formatKitchenRange,
  mapWeeklyFromResponse,
  MEAL_LABELS,
  MEAL_TOOLTIPS,
  type DayErrors,
  type MealError,
  type MealKey,
  validateServices,
} from './availabilityScheduleManagerUtils';
import { GoogleBusinessProfileSyncActionDialog } from './google-business-profile/GoogleBusinessProfileSyncActionDialog';
import {
  deriveServicePeriodDayComparisons,
  deriveServicePeriodsVerification,
} from './google-business-profile/googleBusinessProfileVerification';
import { GoogleBusinessProfileVerificationControls } from './google-business-profile/GoogleBusinessProfileVerificationControls';
import { GoogleBusinessProfileComparisonBadge } from './GoogleBusinessProfileComparisonBadge';
import {
  buildServicePeriodPayload,
  buildServicePeriodState,
  type DayServiceConfig,
  type MealConfig,
} from './servicePeriodsMapper';
import { SETTINGS_COMPACT_HELPER_TEXT_CLASS, SettingsCard } from './shared';
import { DAYS_OF_WEEK, type ServicePeriodRow } from './types';

type ServicePeriodsSectionProps = {
  restaurantId: string | null;
};

function MealEditor({
  label,
  tooltip,
  meal,
  disabled,
  errors,
  onToggle,
  onChange,
}: {
  label: string;
  tooltip: string;
  meal: MealConfig;
  disabled: boolean;
  errors?: MealError;
  onToggle: (value: boolean) => void;
  onChange: (field: 'startTime' | 'endTime', value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <HelpTooltip
              description={tooltip}
              ariaLabel={`${label} service window help`}
              align="center"
            />
          </div>
          <p className="text-xs text-muted-foreground">Only available while the kitchen is open.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${label}-toggle`} className="text-xs text-muted-foreground">
            Active
          </Label>
          <Switch
            id={`${label}-toggle`}
            checked={meal.enabled}
            disabled={disabled}
            onCheckedChange={onToggle}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
          <Input
            type="time"
            value={meal.startTime}
            disabled={disabled || !meal.enabled}
            onChange={(event) => onChange('startTime', event.target.value)}
            aria-invalid={Boolean(errors?.start)}
            className={cn('mt-1 h-9', errors?.start && 'border-destructive')}
          />
          {errors?.start && <p className="mt-1 text-xs text-destructive">{errors.start}</p>}
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
          <Input
            type="time"
            value={meal.endTime}
            disabled={disabled || !meal.enabled}
            onChange={(event) => onChange('endTime', event.target.value)}
            aria-invalid={Boolean(errors?.end)}
            className={cn('mt-1 h-9', errors?.end && 'border-destructive')}
          />
          {errors?.end && <p className="mt-1 text-xs text-destructive">{errors.end}</p>}
        </div>
      </div>
    </div>
  );
}

export function ServicePeriodsSection({ restaurantId }: ServicePeriodsSectionProps) {
  const periodsQuery = useOpsServicePeriods(restaurantId);
  const hoursQuery = useOpsOperatingHours(restaurantId);
  const gbpConnectionQuery = useOpsGoogleBusinessProfileConnection(restaurantId);
  const occasionQuery = useOpsOccasions();
  const updateMutation = useOpsUpdateServicePeriods(restaurantId);
  const syncMutation = useOpsSyncServicePeriodsWithGoogleBusinessProfile(restaurantId);

  const occasionOptions = useMemo(() => occasionQuery.data ?? [], [occasionQuery.data]);
  const occasionKeys = useMemo(
    () => extractRequiredOccasionKeys(occasionOptions),
    [occasionOptions],
  );

  const [dayConfigs, setDayConfigs] = useState<DayServiceConfig[]>([]);
  const [customRows, setCustomRows] = useState<ServicePeriodRow[]>([]);
  const [errors, setErrors] = useState<DayErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [syncDialogMode, setSyncDialogMode] = useState<null | 'pull' | 'push'>(null);

  const weeklyHoursMap = useMemo(
    () =>
      hoursQuery.data?.weekly
        ? buildWeeklyHoursMap(mapWeeklyFromResponse(hoursQuery.data.weekly))
        : {},
    [hoursQuery.data?.weekly],
  );

  const initializeState = useCallback(() => {
    if (!periodsQuery.data || !hoursQuery.data) {
      return;
    }
    const { days, custom } = buildServicePeriodState({
      periods: periodsQuery.data,
      weeklyHours: weeklyHoursMap,
      dayLabels: DAYS_OF_WEEK,
    });
    setDayConfigs(days);
    setCustomRows(custom);
    setErrors({});
    setIsDirty(false);
  }, [hoursQuery.data, periodsQuery.data, weeklyHoursMap]);

  useEffect(() => {
    initializeState();
  }, [initializeState]);

  const hasRequiredOccasions = Boolean(occasionKeys.lunch && occasionKeys.dinner);

  const handleMealToggle = (dayIndex: number, mealKey: MealKey, value: boolean) => {
    const targetDay = dayConfigs[dayIndex];
    setDayConfigs((current) => {
      const target = current[dayIndex];
      if (!target) return current;
      const next = [...current];
      next[dayIndex] = {
        ...target,
        [mealKey]: {
          ...target[mealKey],
          enabled: value,
        },
      };
      return next;
    });
    setErrors((prev) => {
      if (!targetDay) {
        return prev;
      }
      const next = { ...prev };
      const dayError = { ...(next[targetDay.dayOfWeek] ?? {}) };
      delete dayError[mealKey];
      if (Object.keys(dayError).length === 0) {
        delete next[targetDay.dayOfWeek];
      } else {
        next[targetDay.dayOfWeek] = dayError;
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleMealTimeChange = (
    dayIndex: number,
    mealKey: MealKey,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    const targetDay = dayConfigs[dayIndex];
    setDayConfigs((current) => {
      const target = current[dayIndex];
      if (!target) return current;
      const next = [...current];
      next[dayIndex] = {
        ...target,
        [mealKey]: {
          ...target[mealKey],
          [field]: value,
        },
      };
      return next;
    });
    setErrors((prev) => {
      if (!targetDay) {
        return prev;
      }
      const next = { ...prev };
      const dayError = { ...(next[targetDay.dayOfWeek] ?? {}) };
      if (dayError[mealKey]) {
        dayError[mealKey] = { ...dayError[mealKey] };
        delete dayError[mealKey]?.[field === 'startTime' ? 'start' : 'end'];
        if (dayError[mealKey] && Object.keys(dayError[mealKey] as MealError).length === 0) {
          delete dayError[mealKey];
        }
      }
      if (Object.keys(dayError).length === 0) {
        delete next[targetDay.dayOfWeek];
      } else {
        next[targetDay.dayOfWeek] = dayError;
      }
      return next;
    });
    setIsDirty(true);
  };

  const validate = (): boolean => {
    if (dayConfigs.length === 0) {
      return false;
    }
    const result = validateServices(dayConfigs);
    setErrors(result.serviceErrors);
    return result.isValid;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }
    if (!hasRequiredOccasions) {
      return;
    }

    const payload = buildServicePeriodPayload(dayConfigs, {
      customRows,
      canonicalizeTime: canonicalizeRequiredTime,
      occasionKeys: {
        lunch: occasionKeys.lunch!,
        dinner: occasionKeys.dinner!,
      },
    });

    try {
      await updateMutation.mutateAsync(payload);
      initializeState();
      setIsDirty(false);
    } catch (error) {
      console.error('[service-periods] save failed', error);
    }
  };

  const handleReset = () => {
    initializeState();
  };

  const isDisabled = updateMutation.isPending || !hasRequiredOccasions;
  const gbpVerification = deriveServicePeriodsVerification({
    periods: periodsQuery.data,
    connection: gbpConnectionQuery.data,
  });
  const dayComparisons = deriveServicePeriodDayComparisons({
    days: dayConfigs.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      lunch: {
        enabled: day.lunch.enabled,
        startTime: day.lunch.startTime,
        endTime: day.lunch.endTime,
      },
      dinner: {
        enabled: day.dinner.enabled,
        startTime: day.dinner.startTime,
        endTime: day.dinner.endTime,
      },
    })),
    connection: gbpConnectionQuery.data,
  });
  const syncSelectionItems = useMemo(
    () =>
      dayConfigs.map((day) => {
        const comparison = dayComparisons[day.dayOfWeek];
        return {
          id: `day:${day.dayOfWeek}`,
          group: 'Days',
          label: day.label,
          description:
            comparison?.tooltipLines.join(' | ') ||
            (day.isClosed
              ? 'Kitchen is closed on this day.'
              : `Kitchen window: ${formatKitchenRange(day.opensAt, day.closesAt)}`),
          defaultChecked: comparison ? comparison.status !== 'verified' : true,
        };
      }),
    [dayComparisons, dayConfigs],
  );
  const activeDirection = syncDialogMode === 'push' ? 'push_to_gbp' : 'pull_from_gbp';

  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled: !isDisabled && isDirty,
      handler: () => {
        if (!isDisabled && isDirty) {
          void handleSave();
        }
      },
    },
  ]);

  if (!restaurantId) {
    return (
      <SettingsCard title="Service Periods">
        <div className="flex min-h-[200px] items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            Select a restaurant to manage service periods
          </p>
        </div>
      </SettingsCard>
    );
  }

  const loadError = periodsQuery.error ?? hoursQuery.error ?? occasionQuery.error ?? null;
  if (loadError) {
    const message =
      loadError instanceof Error ? loadError.message : 'Unable to load service periods';
    return (
      <SettingsCard title="Service Periods">
        <Alert variant="destructive">
          <AlertTitle>Unable to load service periods</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  if (
    periodsQuery.isLoading ||
    hoursQuery.isLoading ||
    occasionQuery.isLoading ||
    dayConfigs.length === 0
  ) {
    return (
      <SettingsCard title="Service Periods" description="Loading…">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <SettingsCard
        title="Service Periods"
        description="Configure kitchen windows for lunch and dinner per day."
        headerAction={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HelpTooltip
              description="Lunch and dinner windows must stay inside each day's kitchen hours."
              ariaLabel="Service periods help"
            />
            <GoogleBusinessProfileVerificationControls
              status={gbpVerification.status}
              recommendedDirection={gbpVerification.recommendedDirection}
              canPull={gbpVerification.canPull}
              canPush={gbpVerification.canPush}
              disabled={isDirty}
              onPull={() => setSyncDialogMode('pull')}
              onPush={() => setSyncDialogMode('push')}
              isPulling={
                syncMutation.isPending && syncMutation.variables?.direction === 'pull_from_gbp'
              }
              isPushing={
                syncMutation.isPending && syncMutation.variables?.direction === 'push_to_gbp'
              }
            />
          </div>
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Lunch & dinner availability follows kitchen windows.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isDisabled || !isDirty}
              >
                Reset
              </Button>
              <Button type="button" onClick={handleSave} disabled={isDisabled || !isDirty}>
                Save changes
              </Button>
            </div>
          </div>
        }
        stickyFooter
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">{gbpVerification.summary}</p>
            <p className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
              GBP sync maps meal windows through kitchen more-hours so split days like `12:00–15:00`
              and `17:00–22:00` stay aligned with lunch and dinner.
            </p>
            {isDirty ? (
              <p className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
                Save or reset local changes before running a GBP sync for this section.
              </p>
            ) : null}
            {gbpVerification.warnings.map((warning) => (
              <p key={warning} className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
                {warning}
              </p>
            ))}
            {syncMutation.error ? (
              <p className="text-xs text-destructive">{syncMutation.error.message}</p>
            ) : null}
          </div>
          {!hasRequiredOccasions && (
            <Alert variant="destructive">
              <AlertTitle>Missing booking occasions</AlertTitle>
              <AlertDescription>
                Ensure lunch and dinner occasions exist before editing service periods.
              </AlertDescription>
            </Alert>
          )}

          {customRows.length > 0 && (
            <Alert>
              <AlertTitle>Additional service periods preserved</AlertTitle>
              <AlertDescription>
                {customRows.length} custom period{customRows.length === 1 ? '' : 's'} exist outside
                the lunch/dinner layout. They will be saved unchanged.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3">
            {dayConfigs.map((day, index) => {
              const comparison = dayComparisons[day.dayOfWeek];

              return (
                <div
                  key={day.dayOfWeek}
                  className="rounded-xl border border-border/70 bg-card/30 p-4 shadow-sm"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{day.label}</p>
                        {comparison && comparison.status !== 'unavailable' ? (
                          <GoogleBusinessProfileComparisonBadge
                            status={comparison.status}
                            tooltipTitle={comparison.tooltipTitle}
                            tooltipLines={comparison.tooltipLines}
                            tooltipFooter={comparison.tooltipFooter}
                            ariaLabel={`Show GBP service-period details for ${day.label}`}
                          />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {day.isClosed
                          ? 'Closed'
                          : `Kitchen can operate between ${formatKitchenRange(day.opensAt, day.closesAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <MealEditor
                      label={MEAL_LABELS.lunch}
                      tooltip={MEAL_TOOLTIPS.lunch}
                      meal={day.lunch}
                      disabled={day.isClosed || isDisabled}
                      errors={errors[day.dayOfWeek]?.lunch}
                      onToggle={(value) => handleMealToggle(index, 'lunch', value)}
                      onChange={(field, value) =>
                        handleMealTimeChange(index, 'lunch', field, value)
                      }
                    />
                    <MealEditor
                      label={MEAL_LABELS.dinner}
                      tooltip={MEAL_TOOLTIPS.dinner}
                      meal={day.dinner}
                      disabled={day.isClosed || isDisabled}
                      errors={errors[day.dayOfWeek]?.dinner}
                      onToggle={(value) => handleMealToggle(index, 'dinner', value)}
                      onChange={(field, value) =>
                        handleMealTimeChange(index, 'dinner', field, value)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <GoogleBusinessProfileSyncActionDialog
          open={syncDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSyncDialogMode(null);
            }
          }}
          title={
            syncDialogMode === 'push'
              ? 'Push service-period days to GBP'
              : 'Import service-period days from GBP'
          }
          description={
            syncDialogMode === 'push'
              ? 'Choose which day-level lunch and dinner windows should be exported from Nabatable to Google Business Profile.'
              : 'Choose which day-level lunch and dinner windows should be imported from Google Business Profile into Nabatable.'
          }
          confirmLabel={syncDialogMode === 'push' ? 'Push selected days' : 'Import selected days'}
          items={syncSelectionItems}
          isPending={syncMutation.isPending}
          errorMessage={syncMutation.error?.message ?? null}
          onConfirm={({ password, selectedIds }) => {
            const dayOfWeeks = selectedIds
              .filter((id) => id.startsWith('day:'))
              .map((id) => Number.parseInt(id.replace('day:', ''), 10))
              .filter(Number.isInteger);

            syncMutation.mutate(
              {
                direction: activeDirection,
                password,
                selection: {
                  dayOfWeeks,
                },
              },
              {
                onSuccess: () => {
                  setSyncDialogMode(null);
                },
              },
            );
          }}
        />
      </SettingsCard>
    </TooltipProvider>
  );
}
