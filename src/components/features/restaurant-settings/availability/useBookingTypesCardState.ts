'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { queryKeys } from '@/lib/query/keys';

import { persistAvailabilityOccasionDrafts } from '../availabilityScheduleManagerPersistence';
import { buildAvailabilityTurnBandsPayload } from '../availabilitySchedulePayloadDomain';
import { validateTurnBandRows, type TurnBandRowError } from '../turnBandsDomain';

import type { OpsOccasion } from '@/services/ops/occasions';
import type { TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type UseBookingTypesCardStateOptions = {
  restaurantId: string | null;
};

export function useBookingTypesCardState({ restaurantId }: UseBookingTypesCardStateOptions) {
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
  }, [
    occasionsQuery.data,
    turnBandsQuery.data,
    isDirty,
    updateTurnBands.isPending,
    initializeState,
  ]);

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

  const handleOccasionsChange = useCallback((next: OpsOccasion[]) => {
    setOccasionDrafts(next);
    setIsDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    initializeState();
  }, [initializeState]);

  const handleSave = useCallback(async () => {
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
      await persistAvailabilityOccasionDrafts({
        draftOccasions: occasionDrafts,
        occasionService,
        originalOccasions: occasionsQuery.data ?? [],
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });

      const bandsPayload = buildAvailabilityTurnBandsPayload({
        occasionDrafts,
        servicePeriods: servicePeriodsQuery.data ?? [],
        turnBandsDraft,
      });

      const snapshot = await updateTurnBands.mutateAsync(bandsPayload);
      setTurnBandsDraft(snapshot.bands ?? {});
      setIsDirty(false);
      toast.success('Booking types and dining durations saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save booking types.');
    }
  }, [
    isDirty,
    updateTurnBands,
    turnBandsDraft,
    occasionDrafts,
    occasionService,
    occasionsQuery.data,
    queryClient,
    servicePeriodsQuery.data,
  ]);

  const loadError = occasionsQuery.error ?? turnBandsQuery.error;
  const isLoading = occasionsQuery.isLoading || turnBandsQuery.isLoading || !hasInitialized;
  const turnBandDefaults = turnBandsQuery.data?.defaults ?? {};

  return {
    handleOccasionsChange,
    handleReset,
    handleSave,
    handleTurnBandsChange,
    hasInitialized,
    isDirty,
    isLoading,
    loadError,
    occasionDrafts,
    turnBandDefaults,
    turnBandErrors,
    turnBandsDraft,
    updateTurnBands,
  };
}

export type BookingTypesCardState = ReturnType<typeof useBookingTypesCardState>;
