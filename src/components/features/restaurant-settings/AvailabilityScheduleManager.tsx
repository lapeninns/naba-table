'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock3, RotateCcw, Save, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { AvailabilityOccasionsEditor } from './AvailabilityOccasionsEditor';
import { AvailabilityOverridesEditor } from './AvailabilityOverridesEditor';
import { AvailabilityScheduleDayCard } from './AvailabilityScheduleDayCard';
import {
  buildOperatingHoursPayload,
  buildMissingRequiredOccasions,
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
import {
  buildServicePeriodPayload,
  buildServicePeriodState,
  type DayServiceConfig,
} from './servicePeriodsMapper';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STATUS_ROW_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
} from './shared';
import { validateTurnBandRows, type TurnBandRowError } from './TurnBandsEditor';
import {
  DAYS_OF_WEEK,
  type OverrideErrors,
  type OverrideRow,
  type WeeklyErrors,
  type WeeklyRow,
} from './types';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { ServicePeriodRow, TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type AvailabilityScheduleManagerProps = {
  restaurantId: string | null;
  activeWorkspace?: 'schedule' | 'booking-types';
};

type SaveState = {
  variant: 'destructive' | 'success' | 'warning';
  title: string;
  message: string;
  details?: string[];
} | null;

export function AvailabilityScheduleManager({
  restaurantId,
  activeWorkspace = 'schedule',
}: AvailabilityScheduleManagerProps) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const turnBandsQuery = useOpsTurnBands(restaurantId);
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);
  const updateServicePeriods = useOpsUpdateServicePeriods(restaurantId);
  const updateTurnBands = useOpsUpdateTurnBands(restaurantId);
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(defaultWeeklyRows);
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [dayConfigs, setDayConfigs] = useState<DayServiceConfig[]>([]);
  const [customRows, setCustomRows] = useState<ServicePeriodRow[]>([]);
  const [occasionDrafts, setOccasionDrafts] = useState<OpsOccasion[]>([]);
  const [turnBandsDraft, setTurnBandsDraft] = useState<TurnBandsPayload>({});
  const [turnBandErrors, setTurnBandErrors] = useState<Record<string, TurnBandRowError[]>>({});
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);
  const [serviceErrors, setServiceErrors] = useState<DayErrors>({});
  const [hoursDirty, setHoursDirty] = useState(false);
  const [servicesDirty, setServicesDirty] = useState(false);
  const [occasionsDirty, setOccasionsDirty] = useState(false);
  const [turnBandsDirty, setTurnBandsDirty] = useState(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const occasionOptions = useMemo(() => occasionsQuery.data ?? [], [occasionsQuery.data]);
  const occasionKeys = useMemo(
    () => extractRequiredOccasionKeys(occasionOptions),
    [occasionOptions],
  );

  const initializeState = useCallback(
    (resetSaveState = true) => {
      if (
        !operatingHoursQuery.data ||
        !servicePeriodsQuery.data ||
        !occasionsQuery.data ||
        !turnBandsQuery.data
      ) {
        return;
      }
      const nextWeeklyRows = mapWeeklyFromResponse(operatingHoursQuery.data.weekly);
      const { custom, days } = buildServicePeriodState({
        periods: servicePeriodsQuery.data,
        weeklyHours: buildWeeklyHoursMap(nextWeeklyRows),
        dayLabels: nextWeeklyRows.map((row) => DAYS_OF_WEEK[row.dayOfWeek]),
      });

      setWeeklyRows(nextWeeklyRows);
      setOverrideRows(mapOverridesFromResponse(operatingHoursQuery.data.overrides));
      setDayConfigs(days);
      setCustomRows(custom);
      setOccasionDrafts(occasionsQuery.data);
      setTurnBandsDraft(turnBandsQuery.data.bands ?? {});
      setTurnBandErrors({});
      setWeeklyErrors({});
      setOverrideErrors([]);
      setServiceErrors({});
      setHoursDirty(false);
      setServicesDirty(false);
      setOccasionsDirty(false);
      setTurnBandsDirty(false);
      if (resetSaveState) {
        setSaveState(null);
      }
      setHasInitialized(true);
    },
    [occasionsQuery.data, operatingHoursQuery.data, servicePeriodsQuery.data, turnBandsQuery.data],
  );

  const isSaving =
    isSavingConfiguration ||
    updateOperatingHours.isPending ||
    updateServicePeriods.isPending ||
    updateTurnBands.isPending;
  const hasLocalChanges = hoursDirty || servicesDirty || occasionsDirty || turnBandsDirty;
  const hasRequiredOccasions = Boolean(occasionKeys.lunch && occasionKeys.dinner);

  useRegisterOpsUnsavedChanges(
    'availability-command-center',
    hasLocalChanges,
    'You have unsaved availability changes in this settings workspace. Leave without saving them?',
  );

  useEffect(() => {
    if (
      !operatingHoursQuery.data ||
      !servicePeriodsQuery.data ||
      !occasionsQuery.data ||
      !turnBandsQuery.data
    ) {
      return;
    }
    if (!hasInitialized) {
      initializeState();
      return;
    }
    if (!hasLocalChanges && !isSaving) {
      initializeState(false);
    }
  }, [
    hasInitialized,
    hasLocalChanges,
    initializeState,
    isSaving,
    operatingHoursQuery.data,
    occasionsQuery.data,
    servicePeriodsQuery.data,
    turnBandsQuery.data,
  ]);

  const clearSaveState = () => setSaveState(null);

  const createRequiredOccasions = async () => {
    const missingOccasions = buildMissingRequiredOccasions(occasionKeys);

    if (missingOccasions.length === 0) {
      return;
    }

    try {
      setIsSavingConfiguration(true);
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
      setSaveState({
        variant: 'success',
        title: 'Required booking types created',
        message: 'Lunch and dinner are now available for service-window scheduling.',
        details: missingOccasions.map((occasion) => `${occasion.label}: created`),
      });
    } catch (error) {
      setSaveState({
        variant: 'destructive',
        title: 'Unable to create required booking types',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSavingConfiguration(false);
    }
  };

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

  const handleTurnBandsChange = useCallback((optionKey: string, nextBands: TurnBandInput[]) => {
    setTurnBandsDraft((current) => {
      const next = { ...current };
      if (!nextBands || nextBands.length === 0) {
        delete next[optionKey];
      } else {
        next[optionKey] = nextBands;
      }
      return next;
    });
    setTurnBandErrors((prev) => {
      const next = { ...prev };
      delete next[optionKey];
      return next;
    });
    setTurnBandsDirty(true);
    clearSaveState();
  }, []);

  const handleSave = async () => {
    if (!hoursDirty && !servicesDirty && !occasionsDirty && !turnBandsDirty) {
      return;
    }

    const hourValidation = validateHours(weeklyRows, overrideRows);
    const serviceValidation = validateServices(dayConfigs);

    const nextTurnBandErrors: Record<string, TurnBandRowError[]> = {};
    let turnBandsValid = true;
    Object.entries(turnBandsDraft).forEach(([optionKey, rows]) => {
      if (!rows || rows.length === 0) return;
      const validation = validateTurnBandRows(rows);
      if (!validation.ok) {
        nextTurnBandErrors[optionKey] = validation.errors;
        turnBandsValid = false;
      }
    });

    setWeeklyErrors(hourValidation.weeklyErrors);
    setOverrideErrors(hourValidation.overrideErrors);
    setServiceErrors(serviceValidation.serviceErrors);
    setTurnBandErrors(nextTurnBandErrors);

    if (!hourValidation.isValid || !serviceValidation.isValid || !turnBandsValid) {
      setSaveState({
        variant: 'destructive',
        title: 'Review highlighted fields',
        message:
          'Fix validation issues in the schedule, overrides, or dining-duration bands before saving.',
      });
      return;
    }

    if (servicesDirty && !hasRequiredOccasions) {
      setSaveState({
        variant: 'destructive',
        title: 'Missing booking types',
        message: 'Create active Lunch and Dinner booking types before saving service windows.',
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
    const savedSections: string[] = [];

    try {
      setIsSavingConfiguration(true);
      if (hoursDirty) {
        await updateOperatingHours.mutateAsync(operatingHoursPayload);
        hoursSaved = true;
        setHoursDirty(false);
        savedSections.push('Weekly hours and overrides: saved');
      }

      if (servicesDirty) {
        await updateServicePeriods.mutateAsync(servicePayload);
        setServicesDirty(false);
        savedSections.push('Service windows: saved');
      }

      if (occasionsDirty) {
        const originalOccasions = occasionsQuery.data ?? [];
        const originalByKey = new Map(
          originalOccasions.map((occasion) => [occasion.key, occasion]),
        );
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
        savedSections.push('Booking types: saved');
      }

      if (turnBandsDirty) {
        const activeKeys = new Set<string>();
        (servicePeriodsQuery.data ?? []).forEach((period) => activeKeys.add(period.bookingOption));
        occasionDrafts.forEach((occasion) => activeKeys.add(occasion.key));
        activeKeys.add('lunch');
        activeKeys.add('dinner');

        const bandsPayload: TurnBandsPayload = {};
        Object.entries(turnBandsDraft).forEach(([key, rows]) => {
          if (!rows || rows.length === 0) return;
          if (!activeKeys.has(key)) return;
          bandsPayload[key] = rows
            .map((row) => ({
              maxPartySize: Number(row.maxPartySize),
              durationMinutes: Number(row.durationMinutes),
            }))
            .filter(
              (row) => Number.isFinite(row.maxPartySize) && Number.isFinite(row.durationMinutes),
            )
            .sort((a, b) => a.maxPartySize - b.maxPartySize);
        });

        const snapshot = await updateTurnBands.mutateAsync(bandsPayload);
        setTurnBandsDraft(snapshot.bands ?? {});
        setTurnBandsDirty(false);
        savedSections.push('Dining duration bands: saved');
      }

      setSaveState({
        variant: 'success',
        title: 'Saved just now.',
        message:
          'The weekly schedule, service windows, overrides, and booking types (with their turn times) are now saved.',
        details: savedSections,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setSaveState(
        hoursSaved
          ? {
              variant: 'warning',
              title: 'Partial save completed',
              message:
                'Some availability changes were saved, but another section still needs attention.',
              details: [...savedSections, `Needs attention: ${message}`],
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
        (hoursDirty || servicesDirty || occasionsDirty || turnBandsDirty) &&
        (!servicesDirty || hasRequiredOccasions),
      when: () => true,
      handler: () => {
        void handleSave();
      },
    },
  ]);

  if (!restaurantId) {
    return (
      <Card className={SETTINGS_COMPACT_CARD_CLASS}>
        <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>Select a restaurant to manage availability.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const loadError =
    operatingHoursQuery.error ??
    servicePeriodsQuery.error ??
    occasionsQuery.error ??
    turnBandsQuery.error ??
    null;

  if (loadError) {
    const message =
      loadError instanceof Error ? loadError.message : 'Unable to load availability settings.';
    return (
      <Card className={SETTINGS_COMPACT_CARD_CLASS}>
        <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
          <CardTitle>Weekly schedule</CardTitle>
          <CardDescription>Unable to load the unified availability editor.</CardDescription>
        </CardHeader>
        <CardContent className={SETTINGS_COMPACT_CARD_CONTENT_CLASS}>
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
    turnBandsQuery.isLoading ||
    !hasInitialized
  ) {
    return (
      <Card className={SETTINGS_COMPACT_CARD_CLASS}>
        <CardHeader className={SETTINGS_COMPACT_CARD_HEADER_CLASS}>
          <Badge variant="outline" className="w-fit">
            Weekly schedule
          </Badge>
          <CardTitle className="text-xl">Operating hours and service windows together</CardTitle>
          <CardDescription>Loading the integrated availability editor.</CardDescription>
        </CardHeader>
        <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-3')}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const canSave =
    !isSaving &&
    (hoursDirty || servicesDirty || occasionsDirty || turnBandsDirty) &&
    (!servicesDirty || hasRequiredOccasions);

  const turnBandDefaults = turnBandsQuery.data?.defaults ?? {};
  const isScheduleWorkspace = activeWorkspace === 'schedule';
  const isBookingTypesWorkspace = activeWorkspace === 'booking-types';

  return (
    <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')} id="availability-schedule">
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            {isScheduleWorkspace ? 'Weekly schedule' : 'Booking types'}
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">
              {isScheduleWorkspace
                ? 'Operating hours and service windows together'
                : 'Booking types and turn times'}
            </CardTitle>
            <CardDescription className="max-w-3xl">
              {isScheduleWorkspace
                ? 'Edit the outer open-close window, the nested lunch and dinner windows, and special date overrides from one working surface.'
                : 'Manage lunch, dinner, custom booking types, and party-size turn times without showing the full schedule editor.'}
            </CardDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hoursDirty || servicesDirty || occasionsDirty || turnBandsDirty ? (
            <Badge variant="metric" className="h-8 px-3">
              Unsaved changes in this section
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={cn(SETTINGS_COMPACT_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
        <div id="availability-hours" className="scroll-mt-28" />
        <div id="service-periods" className="scroll-mt-28" />
        {saveState ? (
          <Alert variant={saveState.variant}>
            <AlertCircle className="size-4" />
            <AlertTitle>{saveState.title}</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-2">
                <p>{saveState.message}</p>
                {saveState.details?.length ? (
                  <ul className="flex list-disc flex-col gap-1 pl-5">
                    {saveState.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {!hasRequiredOccasions ? (
          <Alert variant="warning">
            <AlertCircle className="size-4" />
            <AlertTitle>Lunch and dinner booking types are required</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-3">
                <p>
                  Operating hours can still be edited here, but service-window saves need active
                  `Lunch` and `Dinner` booking types.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void createRequiredOccasions()}
                  disabled={isSaving}
                >
                  Create missing lunch and dinner booking types
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {customRows.length > 0 ? (
          <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Additional service periods are preserved</AlertTitle>
            <AlertDescription>
              {customRows.length} custom service period{customRows.length === 1 ? '' : 's'} sit
              outside the lunch-dinner layout. They will be preserved unchanged by this availability
              save flow.
            </AlertDescription>
          </Alert>
        ) : null}

        {isScheduleWorkspace ? (
          <Alert>
            <Clock3 className="size-4" />
            <AlertTitle>How availability saving works</AlertTitle>
            <AlertDescription>
              This page owns the day-to-day availability workflow. Weekly hours, service windows,
              overrides, and booking types (with per-party-size turn times) now live in one editable
              surface with one save action.
            </AlertDescription>
          </Alert>
        ) : null}

        {isScheduleWorkspace ? (
          <Tabs defaultValue="schedule" className="flex flex-col gap-4">
            <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto p-1 sm:w-fit">
              <TabsTrigger value="schedule">Weekly schedule</TabsTrigger>
              <TabsTrigger value="overrides">Date overrides</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-0 flex flex-col gap-4">
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
        ) : null}

        {isBookingTypesWorkspace ? (
          <Alert>
            <UtensilsCrossed className="size-4" />
            <AlertTitle>Booking types control guest choices</AlertTitle>
            <AlertDescription>
              Keep lunch and dinner active, then tune duration and turn-time rules so the booking
              grid matches how service actually runs.
            </AlertDescription>
          </Alert>
        ) : null}

        {isBookingTypesWorkspace ? (
          <AvailabilityOccasionsEditor
            occasions={occasionDrafts}
            onChange={(next) => {
              setOccasionDrafts(next);
              setOccasionsDirty(true);
              clearSaveState();
            }}
            turnBands={turnBandsDraft}
            turnBandDefaults={turnBandDefaults}
            turnBandErrors={turnBandErrors}
            onTurnBandsChange={handleTurnBandsChange}
          />
        ) : null}
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={SETTINGS_COMPACT_HELPER_TEXT_CLASS}>
          Saves the full availability workflow. Save once to persist weekly hours, service windows,
          date overrides, and booking types (with their turn times).
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || !hasLocalChanges}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            <Save data-icon="inline-start" aria-hidden />
            Save configuration
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
