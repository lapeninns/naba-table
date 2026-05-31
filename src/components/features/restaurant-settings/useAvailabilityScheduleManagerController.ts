import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

import { type AvailabilitySaveState } from './AvailabilityScheduleManagerChrome';
import {
  buildAvailabilityDraftOverrides,
  buildAvailabilityScheduleDraftState,
} from './availabilityScheduleManagerDomain';
import { extractRequiredOccasionKeys } from './availabilityScheduleManagerUtils';
import { useOptionalGbpDrift } from './gbp-drift/useGbpDrift';
import { useWorkspaceGbpDriftCheck } from './gbpDriftBadges';
import { useAvailabilityScheduleDraft } from './useAvailabilityScheduleDraft';
import { useAvailabilityScheduleSaveActions } from './useAvailabilityScheduleSaveActions';

import type { TurnBandsPayload } from '@/services/ops/restaurants';

export type AvailabilityScheduleManagerWorkspace = 'schedule' | 'booking-types';

type UseAvailabilityScheduleManagerControllerOptions = {
  readonly activeWorkspace: AvailabilityScheduleManagerWorkspace;
  readonly restaurantId: string | null;
};

const AVAILABILITY_DRIFT_SECTIONS = ['operatingHours', 'servicePeriods'] as const;
const EMPTY_TURN_BANDS: TurnBandsPayload = {};

export function useAvailabilityScheduleManagerController({
  activeWorkspace,
  restaurantId,
}: UseAvailabilityScheduleManagerControllerOptions) {
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const turnBandsQuery = useOpsTurnBands(restaurantId);
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);
  const updateServicePeriods = useOpsUpdateServicePeriods(restaurantId);
  const updateTurnBands = useOpsUpdateTurnBands(restaurantId);
  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const clearDriftDraftOverrides = registryDrift?.clearDraftOverrides;
  const registeredAvailabilityDraftKeysRef = useRef<Set<string>>(new Set());
  const gbpDrift = useWorkspaceGbpDriftCheck({
    restaurantId,
    sectionKeys: AVAILABILITY_DRIFT_SECTIONS,
  });

  const [saveState, setSaveState] = useState<AvailabilitySaveState>(null);
  const clearSaveState = useCallback(() => setSaveState(null), []);
  const draft = useAvailabilityScheduleDraft({ onDraftChanged: clearSaveState });
  const initializeDraftState = draft.initializeDraftState;

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
      const draftState = buildAvailabilityScheduleDraftState({
        occasions: occasionsQuery.data,
        operatingHours: operatingHoursQuery.data,
        servicePeriods: servicePeriodsQuery.data,
        turnBands: turnBandsQuery.data,
      });

      initializeDraftState(draftState);
      if (resetSaveState) {
        setSaveState(null);
      }
    },
    [
      initializeDraftState,
      occasionsQuery.data,
      operatingHoursQuery.data,
      servicePeriodsQuery.data,
      turnBandsQuery.data,
    ],
  );

  const hasRequiredOccasions = Boolean(occasionKeys.lunch && occasionKeys.dinner);
  const { createRequiredOccasions, handleSave, isSaving } = useAvailabilityScheduleSaveActions({
    draft,
    hasRequiredOccasions,
    occasionKeys,
    originalOccasions: occasionsQuery.data ?? [],
    servicePeriods: servicePeriodsQuery.data ?? [],
    setSaveState,
    updateOperatingHours,
    updateServicePeriods,
    updateTurnBands,
  });
  const servicePeriodDriftFields = gbpDrift.getFieldsBySection('servicePeriods');
  const operatingHoursDriftFields = gbpDrift.getFieldsBySection('operatingHours');
  const availabilityDraftOverrides = useMemo(
    () =>
      buildAvailabilityDraftOverrides({
        dayConfigs: draft.dayConfigs,
        occasionKeys,
        servicePeriodDriftFields,
        weeklyRows: draft.weeklyRows,
      }),
    [draft.dayConfigs, draft.weeklyRows, occasionKeys, servicePeriodDriftFields],
  );

  useRegisterOpsUnsavedChanges(
    'availability-command-center',
    draft.hasLocalChanges,
    'You have unsaved availability changes in this settings workspace. Leave without saving them?',
  );

  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    const nextKeys = new Set(availabilityDraftOverrides.map(([fieldKey]) => fieldKey));
    const staleKeys = Array.from(registeredAvailabilityDraftKeysRef.current).filter(
      (fieldKey) => !nextKeys.has(fieldKey),
    );
    if (staleKeys.length > 0) {
      clearDriftDraftOverrides?.(staleKeys);
    }
    for (const [fieldKey, value] of availabilityDraftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
    registeredAvailabilityDraftKeysRef.current = nextKeys;

    return () => {
      if (nextKeys.size > 0) {
        clearDriftDraftOverrides?.(Array.from(nextKeys));
      }
      for (const fieldKey of nextKeys) {
        registeredAvailabilityDraftKeysRef.current.delete(fieldKey);
      }
    };
  }, [availabilityDraftOverrides, clearDriftDraftOverrides, registerDriftDraftOverride]);

  useEffect(() => {
    if (
      !operatingHoursQuery.data ||
      !servicePeriodsQuery.data ||
      !occasionsQuery.data ||
      !turnBandsQuery.data
    ) {
      return;
    }
    if (!draft.hasInitialized) {
      initializeState();
      return;
    }
    if (!draft.hasLocalChanges && !isSaving) {
      initializeState(false);
    }
  }, [
    draft.hasInitialized,
    draft.hasLocalChanges,
    initializeState,
    isSaving,
    operatingHoursQuery.data,
    occasionsQuery.data,
    servicePeriodsQuery.data,
    turnBandsQuery.data,
  ]);

  const handleReset = useCallback(() => {
    initializeState();
  }, [initializeState]);

  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled: !isSaving && draft.hasLocalChanges && (!draft.servicesDirty || hasRequiredOccasions),
      when: () => true,
      handler: () => {
        void handleSave();
      },
    },
  ]);

  const loadError =
    operatingHoursQuery.error ??
    servicePeriodsQuery.error ??
    occasionsQuery.error ??
    turnBandsQuery.error ??
    null;
  const loadErrorMessage =
    loadError instanceof Error
      ? loadError.message
      : loadError
        ? 'Unable to load availability settings.'
        : null;
  const isLoading =
    operatingHoursQuery.isLoading ||
    servicePeriodsQuery.isLoading ||
    occasionsQuery.isLoading ||
    turnBandsQuery.isLoading ||
    !draft.hasInitialized;
  const canSave =
    !isSaving && draft.hasLocalChanges && (!draft.servicesDirty || hasRequiredOccasions);
  const isScheduleWorkspace = activeWorkspace === 'schedule';
  const isBookingTypesWorkspace = activeWorkspace === 'booking-types';

  return {
    canSave,
    createRequiredOccasions,
    draft,
    getWeeklyDriftField: gbpDrift.getField,
    handleReset,
    handleSave,
    hasRequiredOccasions,
    isBookingTypesWorkspace,
    isLoading,
    isSaving,
    isScheduleWorkspace,
    loadErrorMessage,
    occasionKeys,
    operatingHoursDriftFields,
    restaurantIdMissing: !restaurantId,
    saveState,
    servicePeriodDriftFields,
    turnBandDefaults: turnBandsQuery.data?.defaults ?? EMPTY_TURN_BANDS,
  };
}

export type AvailabilityScheduleManagerController = ReturnType<
  typeof useAvailabilityScheduleManagerController
>;
