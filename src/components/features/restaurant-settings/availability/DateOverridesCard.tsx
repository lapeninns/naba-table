'use client';

import { RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { AvailabilityOverridesEditor } from '../AvailabilityOverridesEditor';
import {
  buildOperatingHoursPayload,
  defaultOverrideRow,
  mapOverridesFromResponse,
  mapWeeklyFromResponse,
} from '../availabilityScheduleManagerUtils';
import { validateHours } from '../availabilityScheduleValidation';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';
import { type OverrideErrors, type OverrideRow } from '../types';

type DateOverridesCardProps = {
  restaurantId: string | null;
};

export function DateOverridesCard({ restaurantId }: DateOverridesCardProps) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);

  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const initializeState = useCallback(() => {
    if (!operatingHoursQuery.data) {
      return;
    }
    const nextOverrides = mapOverridesFromResponse(operatingHoursQuery.data.overrides);
    setOverrideRows(nextOverrides);
    setOverrideErrors([]);
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
      const nextOverrides = mapOverridesFromResponse(operatingHoursQuery.data.overrides);
      setOverrideRows(nextOverrides);
    }
  }, [operatingHoursQuery.data, isDirty, updateOperatingHours.isPending]);

  useRegisterOpsUnsavedChanges(
    'date-overrides',
    isDirty,
    'You have unsaved date override changes. Leave without saving them?',
  );

  const handleOverrideChange = useCallback((index: number, patch: Partial<OverrideRow>) => {
    setOverrideRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
    setOverrideErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
    setIsDirty(true);
  }, []);

  const addOverride = () => {
    setOverrideRows((current) => [...current, defaultOverrideRow()]);
    setOverrideErrors((current) => [...current, {}]);
    setIsDirty(true);
  };

  const removeOverride = (index: number) => {
    setOverrideRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setOverrideErrors((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setIsDirty(true);
  };

  const handleReset = () => {
    initializeState();
  };

  const handleSave = async () => {
    if (!isDirty || updateOperatingHours.isPending) {
      return;
    }

    const { isValid, overrideErrors: nextOverrideErrors } = validateHours([], overrideRows);
    setOverrideErrors(nextOverrideErrors);

    if (!isValid) {
      toast.error('Please fix validation issues in the date overrides before saving.');
      return;
    }

    const currentWeekly = mapWeeklyFromResponse(operatingHoursQuery.data?.weekly ?? []);
    const payload = buildOperatingHoursPayload(currentWeekly, overrideRows);

    try {
      await updateOperatingHours.mutateAsync(payload);
      setIsDirty(false);
      toast.success('Date overrides saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save date overrides.');
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
        </CardContent>
      </Card>
    );
  }

  if (operatingHoursQuery.error) {
    return <AvailabilityScheduleErrorState message={operatingHoursQuery.error.message} />;
  }

  return (
    <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')} id="date-overrides">
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
            <CardTitle className="text-xl">Date overrides</CardTitle>
            <CardDescription className="max-w-3xl">
              Closures and special hours override the weekly operating hours template for specific
              dates (e.g. holidays, staff parties).
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
        <AvailabilityOverridesEditor
          onAdd={addOverride}
          onChange={handleOverrideChange}
          onRemove={removeOverride}
          rowErrors={overrideErrors}
          rows={overrideRows}
        />
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('date-overrides')}</p>
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
            Save overrides
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
