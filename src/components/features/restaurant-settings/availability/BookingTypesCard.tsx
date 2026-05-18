'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { AvailabilityScheduleErrorState } from './AvailabilityScheduleStates';
import { BookingTypesWorkspace } from './BookingTypesWorkspace';
import {
  SETTINGS_COMPACT_CARD_CLASS,
  SETTINGS_COMPACT_CARD_CONTENT_CLASS,
  SETTINGS_COMPACT_CARD_HEADER_CLASS,
  SETTINGS_COMPACT_HELPER_TEXT_CLASS,
  SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS,
  formatSaveScopeMessage,
} from '../shared';
import { validateTurnBandRows, type TurnBandRowError } from '../TurnBandsEditor';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type BookingTypesCardProps = {
  restaurantId: string | null;
};

export function BookingTypesCard({ restaurantId }: BookingTypesCardProps) {
  const occasionsQuery = useOpsOccasions();
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const turnBandsQuery = useOpsTurnBands(restaurantId);
  const updateTurnBands = useOpsUpdateTurnBands(restaurantId);
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();

  const [occasionDrafts, setOccasionDrafts] = useState<OpsOccasion[]>([]);
  const [turnBandsDraft, setTurnBandsDraft] = useState<TurnBandsPayload>({});
  const [turnBandErrors, setTurnBandErrors] = useState<Record<string, TurnBandRowError[]>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const initializeState = useCallback(() => {
    if (!occasionsQuery.data || !turnBandsQuery.data) {
      return;
    }
    setOccasionDrafts(occasionsQuery.data);
    setTurnBandsDraft(turnBandsQuery.data.bands ?? {});
    setTurnBandErrors({});
    setIsDirty(false);
    setHasInitialized(true);
  }, [occasionsQuery.data, turnBandsQuery.data]);

  useEffect(() => {
    if (occasionsQuery.data && turnBandsQuery.data && !hasInitialized) {
      initializeState();
    }
  }, [occasionsQuery.data, turnBandsQuery.data, hasInitialized, initializeState]);

  useEffect(() => {
    if (occasionsQuery.data && turnBandsQuery.data && !isDirty && !updateTurnBands.isPending) {
      initializeState();
    }
  }, [occasionsQuery.data, turnBandsQuery.data, isDirty, updateTurnBands.isPending, initializeState]);

  useRegisterOpsUnsavedChanges(
    'booking-occasions-turnbands',
    isDirty,
    'You have unsaved booking types or duration changes. Leave without saving them?',
  );

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
    setIsDirty(true);
  }, []);

  const handleOccasionsChange = (next: OpsOccasion[]) => {
    setOccasionDrafts(next);
    setIsDirty(true);
  };

  const handleReset = () => {
    initializeState();
  };

  const handleSave = async () => {
    if (!isDirty || updateTurnBands.isPending) {
      return;
    }

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

    setTurnBandErrors(nextTurnBandErrors);

    if (!turnBandsValid) {
      toast.error('Please fix validation issues in the duration bands before saving.');
      return;
    }

    try {
      // 1. Save Occasions changes
      const originalOccasions = occasionsQuery.data ?? [];
      const originalByKey = new Map(originalOccasions.map((o) => [o.key, o]));
      const nextByKey = new Map(occasionDrafts.map((o) => [o.key, o]));

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
          JSON.stringify(original.availability ?? []) !== JSON.stringify(occasion.availability ?? []) ||
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

      // 2. Save Turn Bands changes
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
          .filter((row) => Number.isFinite(row.maxPartySize) && Number.isFinite(row.durationMinutes))
          .sort((a, b) => a.maxPartySize - b.maxPartySize);
      });

      const snapshot = await updateTurnBands.mutateAsync(bandsPayload);
      setTurnBandsDraft(snapshot.bands ?? {});
      setIsDirty(false);
      toast.success('Booking types and dining durations saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save booking types.');
    }
  };

  if (!restaurantId) {
    return null;
  }

  if (occasionsQuery.isLoading || turnBandsQuery.isLoading || !hasInitialized) {
    return (
      <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')}>
        <CardHeader className={cn(SETTINGS_COMPACT_CARD_HEADER_CLASS, 'pb-3')}>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const loadError = occasionsQuery.error ?? turnBandsQuery.error;
  if (loadError) {
    return <AvailabilityScheduleErrorState message={loadError.message} />;
  }

  const turnBandDefaults = turnBandsQuery.data?.defaults ?? {};

  return (
    <Card className={cn(SETTINGS_COMPACT_CARD_CLASS, 'overflow-hidden')} id="booking-occasions">
      <CardHeader
        className={cn(
          SETTINGS_COMPACT_CARD_HEADER_CLASS,
          'gap-3 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-end sm:justify-between',
        )}
      >
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit">
            Booking types
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-xl">Booking types and turn times</CardTitle>
            <CardDescription className="max-w-3xl">
              Configure Lunch, Dinner, and custom reservation sessions with their turn-time duration limits.
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
        <BookingTypesWorkspace
          occasionDrafts={occasionDrafts}
          onOccasionsChange={handleOccasionsChange}
          onTurnBandsChange={handleTurnBandsChange}
          turnBandDefaults={turnBandDefaults}
          turnBandErrors={turnBandErrors}
          turnBandsDraft={turnBandsDraft}
        />
      </CardContent>

      <CardFooter
        className={cn(SETTINGS_COMPACT_STICKY_ACTION_ROW_CLASS, 'border-primary/20 shadow-lg')}
      >
        <div className={cn(SETTINGS_COMPACT_HELPER_TEXT_CLASS, 'flex flex-col gap-1')}>
          <p>{formatSaveScopeMessage('booking-occasions')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={updateTurnBands.isPending || !isDirty}
          >
            <RotateCcw data-icon="inline-start" aria-hidden />
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isDirty || updateTurnBands.isPending}>
            <Save data-icon="inline-start" aria-hidden />
            Save booking types
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
