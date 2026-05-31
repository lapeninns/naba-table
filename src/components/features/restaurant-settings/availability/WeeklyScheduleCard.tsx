'use client';

import { RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { cn } from '@/lib/utils';

import { AvailabilityScheduleErrorState } from './AvailabilityScheduleStates';
import { AvailabilityScheduleDayCard } from './ScheduleDayCard';
import { AVAILABILITY_ANCHORS } from '../availabilityAnchors';
import {
  buildOperatingHoursPayload,
  defaultWeeklyRows,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
} from '../availabilityScheduleManagerUtils';
import { validateHours } from '../availabilityScheduleValidation';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { useWorkspaceGbpDriftCheck } from '../gbpDriftBadges';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';
import { type WeeklyErrors, type WeeklyRow } from '../types';

type WeeklyScheduleCardProps = {
  restaurantId: string | null;
};

export function WeeklyScheduleCard({ restaurantId }: WeeklyScheduleCardProps) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);

  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const gbpDrift = useWorkspaceGbpDriftCheck({
    restaurantId,
    sectionKeys: ['operatingHours'],
  });

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(defaultWeeklyRows);
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const initializeState = useCallback(() => {
    if (!operatingHoursQuery.data) {
      return;
    }
    const nextWeeklyRows = mapWeeklyFromResponse(operatingHoursQuery.data.weekly);
    setWeeklyRows(nextWeeklyRows);
    setWeeklyErrors({});
    setIsDirty(false);
    setHasInitialized(true);
  }, [operatingHoursQuery.data]);

  useEffect(() => {
    if (operatingHoursQuery.data && !hasInitialized) {
      initializeState();
    }
  }, [operatingHoursQuery.data, hasInitialized, initializeState]);

  useEffect(() => {
    if (operatingHoursQuery.data && !isDirty && !updateOperatingHours.isPending) {
      const nextWeeklyRows = mapWeeklyFromResponse(operatingHoursQuery.data.weekly);
      setWeeklyRows(nextWeeklyRows);
    }
  }, [operatingHoursQuery.data, isDirty, updateOperatingHours.isPending]);

  const availabilityDraftOverrides = useMemo(() => {
    return weeklyRows.map(
      (row) =>
        [
          `operatingHours.weekly.${row.dayOfWeek}`,
          {
            opensAt: row.opensAt,
            closesAt: row.closesAt,
            isClosed: row.isClosed,
          },
        ] as const,
    );
  }, [weeklyRows]);

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    for (const [fieldKey, value] of availabilityDraftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
  }, [availabilityDraftOverrides, registerDriftDraftOverride]);

  useRegisterOpsUnsavedChanges(
    'weekly-operating-hours',
    isDirty,
    'You have unsaved operating hour changes. Leave without saving them?',
  );

  const handleWeeklyChange = useCallback((dayIndex: number, patch: Partial<WeeklyRow>) => {
    setWeeklyRows((current) =>
      current.map((row, index) => (index === dayIndex ? { ...row, ...patch } : row)),
    );
    setWeeklyErrors((prev) => {
      const next = { ...prev };
      delete next[dayIndex];
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleReset = () => {
    initializeState();
  };

  const handleSave = async () => {
    if (!isDirty || updateOperatingHours.isPending) {
      return;
    }

    const { isValid, weeklyErrors: nextWeeklyErrors } = validateHours(weeklyRows, []);
    setWeeklyErrors(nextWeeklyErrors);

    if (!isValid) {
      toast.error('Please fix validation issues in the weekly hours before saving.');
      return;
    }

    const currentOverrides = mapOverridesFromResponse(operatingHoursQuery.data?.overrides ?? []);
    const payload = buildOperatingHoursPayload(weeklyRows, currentOverrides);

    try {
      await updateOperatingHours.mutateAsync(payload);
      setIsDirty(false);
      toast.success('Weekly operating hours saved successfully.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save weekly operating hours.',
      );
    }
  };

  if (!restaurantId) {
    return null;
  }

  if (operatingHoursQuery.isLoading || !hasInitialized) {
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

  if (operatingHoursQuery.error) {
    return <AvailabilityScheduleErrorState message={operatingHoursQuery.error.message} />;
  }

  return (
    <Card
      className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')}
      id={AVAILABILITY_ANCHORS.weeklyHours}
    >
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
            <CardTitle className="text-xl">Weekly operating hours</CardTitle>
            <CardDescription className="max-w-3xl">
              Set the outer kitchen open and close boundary for each day. Kitchen operating hours
              sync across guest booking engines.
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
        {weeklyRows.map((row) => (
          <AvailabilityScheduleDayCard
            key={row.dayOfWeek}
            day={undefined}
            dayError={undefined}
            hasRequiredOccasions={false}
            onMealTimeChange={() => {}}
            onMealToggle={() => {}}
            onWeeklyChange={handleWeeklyChange}
            row={row}
            rowErrors={weeklyErrors[row.dayOfWeek]}
            weeklyDriftField={gbpDrift.getField(`operatingHours.weekly.${row.dayOfWeek}`)}
            serviceDriftFields={[]}
            showServiceWindows={false}
          />
        ))}
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('weekly-hours')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={updateOperatingHours.isPending || !isDirty}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || updateOperatingHours.isPending}
          >
            <Save data-icon="inline-start" aria-hidden />
            Save hours
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
