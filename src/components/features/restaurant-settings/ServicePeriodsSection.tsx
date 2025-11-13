'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsOccasions, useOpsOperatingHours, useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks';
import { cn } from '@/lib/utils';

import { buildServicePeriodPayload, buildServicePeriodState, type DayServiceConfig, type MealConfig, type WeeklyHoursEntry } from './servicePeriodsMapper';
import { DAYS_OF_WEEK, type ServicePeriodRow } from './types';

import type { OccasionDefinition } from '@reserve/shared/occasions';

type ServicePeriodsSectionProps = {
  restaurantId: string | null;
};

type MealKey = 'lunch' | 'dinner';

type MealError = {
  start?: string;
  end?: string;
};

type DayErrors = Record<number, Partial<Record<MealKey, MealError>>>;

const MEAL_LABELS: Record<MealKey, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const MEAL_TOOLTIPS: Record<MealKey, string> = {
  lunch: 'Defines when lunch reservations can be booked within the kitchen operating window.',
  dinner: 'Defines when dinner reservations can be booked. Keep times inside the kitchen open/close window.',
};

function canonicalizeRequiredTime(value: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return '';
  }
  return normalized.length >= 5 ? normalized.slice(0, 5) : normalized;
}

function toComparableTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

const buildWeeklyHoursMap = (
  weekly?: Array<{ dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }>,
): Record<number, WeeklyHoursEntry> => {
  if (!weekly) {
    return {};
  }
  return weekly.reduce<Record<number, WeeklyHoursEntry>>((acc, row) => {
    acc[row.dayOfWeek] = {
      opensAt: row.opensAt,
      closesAt: row.closesAt,
      isClosed: row.isClosed,
    };
    return acc;
  }, {});
};

const extractRequiredOccasionKeys = (options: OccasionDefinition[]) => {
  const map: { lunch?: string; dinner?: string; drinks?: string } = {};
  options.forEach((definition) => {
    const lower = definition.key.toLowerCase();
    if (lower === 'lunch' || lower === 'dinner' || lower === 'drinks') {
      map[lower] = definition.key;
    }
  });
  return map;
};

const formatRange = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return 'Not set';
  return `${start} – ${end}`;
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
            <HelpTooltip description={tooltip} ariaLabel={`${label} service window help`} align="center" />
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
  const occasionQuery = useOpsOccasions();
  const updateMutation = useOpsUpdateServicePeriods(restaurantId);

  const occasionOptions = useMemo(() => occasionQuery.data ?? [], [occasionQuery.data]);
  const occasionKeys = useMemo(() => extractRequiredOccasionKeys(occasionOptions), [occasionOptions]);

  const [dayConfigs, setDayConfigs] = useState<DayServiceConfig[]>([]);
  const [customRows, setCustomRows] = useState<ServicePeriodRow[]>([]);
  const [errors, setErrors] = useState<DayErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  const weeklyHoursMap = useMemo(
    () =>
      buildWeeklyHoursMap(
        hoursQuery.data?.weekly?.map((row) => ({
          dayOfWeek: row.dayOfWeek,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
          isClosed: row.isClosed,
        })),
      ),
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

  const hasRequiredOccasions = Boolean(occasionKeys.drinks && occasionKeys.lunch && occasionKeys.dinner);

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

  const handleMealTimeChange = (dayIndex: number, mealKey: MealKey, field: 'startTime' | 'endTime', value: string) => {
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
    let valid = true;
    const nextErrors: DayErrors = {};
    dayConfigs.forEach((day) => {
      if (day.isClosed) {
        return;
      }

      (['lunch', 'dinner'] as MealKey[]).forEach((mealKey) => {
        const meal = day[mealKey];
        if (!meal.enabled) {
          return;
        }
        const mealErrors: MealError = {};
        const startComparable = toComparableTime(meal.startTime);
        const endComparable = toComparableTime(meal.endTime);
        const openComparable = toComparableTime(day.opensAt);
        const closeComparable = toComparableTime(day.closesAt);

        if (!meal.startTime) {
          mealErrors.start = 'Required';
        } else if (!openComparable || !startComparable || startComparable < openComparable) {
          mealErrors.start = 'Before kitchen opens';
        }
        if (!meal.endTime) {
          mealErrors.end = 'Required';
        } else if (!closeComparable || !endComparable || endComparable > closeComparable) {
          mealErrors.end = 'After kitchen closes';
        }
        if (
          !mealErrors.start &&
          !mealErrors.end &&
          startComparable &&
          endComparable &&
          startComparable >= endComparable
        ) {
          mealErrors.end = 'Must be after start';
        }
        if (Object.keys(mealErrors).length > 0) {
          valid = false;
          nextErrors[day.dayOfWeek] = {
            ...(nextErrors[day.dayOfWeek] ?? {}),
            [mealKey]: mealErrors,
          };
        }
      });
    });
    setErrors(nextErrors);
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    if (!hasRequiredOccasions) {
      toast.error('Required booking occasions are missing');
      return;
    }

    const payload = buildServicePeriodPayload(dayConfigs, {
      customRows,
      canonicalizeTime: canonicalizeRequiredTime,
      occasionKeys: {
        lunch: occasionKeys.lunch!,
        dinner: occasionKeys.dinner!,
        drinks: occasionKeys.drinks!,
      },
    });

    try {
      await updateMutation.mutateAsync(payload);
      initializeState();
      toast.success('Service periods updated');
      setIsDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update service periods');
    }
  };

  const handleReset = () => {
    initializeState();
  };

  if (!restaurantId) {
    return (
      <Card>
        <CardContent className="flex min-h-[200px] items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Select a restaurant to manage service periods</p>
        </CardContent>
      </Card>
    );
  }

  const loadError = periodsQuery.error ?? hoursQuery.error ?? occasionQuery.error ?? null;
  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Unable to load service periods';
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Unable to load service periods</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (
    periodsQuery.isLoading ||
    hoursQuery.isLoading ||
    occasionQuery.isLoading ||
    dayConfigs.length === 0
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isDisabled = updateMutation.isPending || !hasRequiredOccasions;

  return (
    <TooltipProvider delayDuration={100}>
      <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Service Periods</CardTitle>
          <HelpTooltip
            description="Lunch and dinner windows must stay inside each day's kitchen hours. Drinks inherit general operating hours."
            ariaLabel="Service periods help"
          />
        </div>
        <CardDescription>
          Drinks automatically follow general opening hours. Configure kitchen windows for lunch and dinner per day.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRequiredOccasions && (
          <Alert variant="destructive">
            <AlertTitle>Missing booking occasions</AlertTitle>
            <AlertDescription>Ensure lunch, dinner, and drinks occasions exist before editing service periods.</AlertDescription>
          </Alert>
        )}

        {customRows.length > 0 && (
          <Alert>
            <AlertTitle>Additional service periods preserved</AlertTitle>
            <AlertDescription>
              {customRows.length} custom period{customRows.length === 1 ? '' : 's'} exist outside the lunch/dinner/drinks
              layout. They will be saved unchanged.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {dayConfigs.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className="rounded-xl border border-border/70 bg-card/30 p-4 shadow-sm"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{day.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {day.isClosed ? 'Closed' : `Kitchen can operate between ${formatRange(day.opensAt, day.closesAt)}`}
                  </p>
                </div>
                <div>
                  {day.isClosed || !day.drinks ? (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">
                      Drinks unavailable (closed)
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Drinks {day.opensAt} – {day.closesAt}</Badge>
                  )}
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
                  onChange={(field, value) => handleMealTimeChange(index, 'lunch', field, value)}
                />
                <MealEditor
                  label={MEAL_LABELS.dinner}
                  tooltip={MEAL_TOOLTIPS.dinner}
                  meal={day.dinner}
                  disabled={day.isClosed || isDisabled}
                  errors={errors[day.dayOfWeek]?.dinner}
                  onToggle={(value) => handleMealToggle(index, 'dinner', value)}
                  onChange={(field, value) => handleMealTimeChange(index, 'dinner', field, value)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/40 px-6 py-4">
        <p className="text-xs text-muted-foreground">Lunch & dinner availability follows kitchen windows; drinks follow opening hours.</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isDisabled || !isDirty}>
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={isDisabled || !isDirty}>
            Save changes
          </Button>
        </div>
      </CardFooter>
    </Card>
    </TooltipProvider>
  );
}
