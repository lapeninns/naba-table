'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { queryKeys } from '@/lib/query/keys';

import {
  buildServiceWindowDraftOverrides,
  buildServiceWindowDriftFieldsForDay,
  buildServiceWindowInitialState,
  buildServiceWindowSavePayload,
  clearServiceWindowMealError,
  updateServiceWindowMealTime,
  updateServiceWindowMealToggle,
} from './serviceWindowsCardDomain';
import {
  buildMissingRequiredOccasions,
  extractRequiredOccasionKeys,
  mapWeeklyFromResponse,
} from '../availabilityScheduleManagerUtils';
import { validateServices, type DayErrors } from '../availabilityScheduleValidation';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { useWorkspaceGbpDriftCheck } from '../gbpDriftBadges';

import type { DayServiceConfig } from '../servicePeriodsMapper';
import type { ServicePeriodRow } from '@/services/ops/restaurants';

type UseServiceWindowsCardStateOptions = {
  restaurantId: string | null;
};

export function useServiceWindowsCardState({ restaurantId }: UseServiceWindowsCardStateOptions) {
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
  const weeklyRows = useMemo(
    () => (operatingHoursQuery.data ? mapWeeklyFromResponse(operatingHoursQuery.data.weekly) : []),
    [operatingHoursQuery.data],
  );

  const initializeState = useCallback(() => {
    if (!operatingHoursQuery.data || !servicePeriodsQuery.data) {
      return;
    }
    const { customRows: nextCustomRows, days } = buildServiceWindowInitialState({
      operatingHours: operatingHoursQuery.data,
      servicePeriods: servicePeriodsQuery.data,
    });
    setDayConfigs(days);
    setCustomRows(nextCustomRows);
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
  const availabilityDraftOverrides = useMemo(
    () =>
      buildServiceWindowDraftOverrides({
        dayConfigs,
        occasionKeys,
        servicePeriodDriftFields,
      }),
    [dayConfigs, occasionKeys, servicePeriodDriftFields],
  );

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

  const handleMealToggle = useCallback(
    (dayIndex: number, mealKey: 'lunch' | 'dinner', value: boolean) => {
      setDayConfigs((current) =>
        updateServiceWindowMealToggle({ current, dayIndex, mealKey, value }),
      );
      setServiceErrors((errors) => clearServiceWindowMealError({ dayIndex, errors, mealKey }));
      setIsDirty(true);
    },
    [],
  );

  const handleMealTimeChange = useCallback(
    (
      dayIndex: number,
      mealKey: 'lunch' | 'dinner',
      field: 'startTime' | 'endTime',
      value: string,
    ) => {
      setDayConfigs((current) =>
        updateServiceWindowMealTime({ current, dayIndex, field, mealKey, value }),
      );
      setServiceErrors((errors) =>
        clearServiceWindowMealError({ dayIndex, errors, field, mealKey }),
      );
      setIsDirty(true);
    },
    [],
  );

  const createRequiredOccasions = useCallback(async () => {
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
  }, [occasionKeys, occasionService, queryClient]);

  const handleReset = useCallback(() => {
    initializeState();
  }, [initializeState]);

  const handleSave = useCallback(async () => {
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

    const payload = buildServiceWindowSavePayload({
      customRows,
      dayConfigs,
      occasionKeys: {
        dinner: occasionKeys.dinner!,
        lunch: occasionKeys.lunch!,
      },
    });

    try {
      await updateServicePeriods.mutateAsync(payload);
      setIsDirty(false);
      toast.success('Service windows saved successfully.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save service windows.');
    }
  }, [customRows, dayConfigs, hasRequiredOccasions, isDirty, occasionKeys, updateServicePeriods]);

  const dayRows = useMemo(
    () =>
      dayConfigs.map((day, index) => ({
        day,
        row: weeklyRows[index],
        serviceDriftFields: buildServiceWindowDriftFieldsForDay({
          day,
          occasionKeys,
          servicePeriodDriftFields,
        }),
      })),
    [dayConfigs, occasionKeys, servicePeriodDriftFields, weeklyRows],
  );

  const loadError = operatingHoursQuery.error ?? servicePeriodsQuery.error ?? occasionsQuery.error;
  const isLoading =
    operatingHoursQuery.isLoading ||
    servicePeriodsQuery.isLoading ||
    occasionsQuery.isLoading ||
    !hasInitialized;

  return {
    createRequiredOccasions,
    dayRows,
    handleMealTimeChange,
    handleMealToggle,
    handleReset,
    handleSave,
    hasInitialized,
    hasRequiredOccasions,
    isCreatingOccasions,
    isDirty,
    isLoading,
    loadError,
    serviceErrors,
    updateServicePeriods,
  };
}

export type ServiceWindowsCardState = ReturnType<typeof useServiceWindowsCardState>;
