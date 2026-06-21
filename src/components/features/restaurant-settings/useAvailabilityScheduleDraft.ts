import { useCallback, useMemo, useState } from 'react';

import {
  clearOverrideErrorAtIndex,
  clearServiceErrorsForDay,
  clearServiceMealError,
  clearServiceMealTimeError,
  clearTurnBandErrors,
  clearWeeklyError,
  removeOverrideAtIndex,
  updateDayConfigsForWeeklyPatch,
  updateMealEnabled,
  updateMealTime,
  updateOverrideRows,
  updateTurnBandsDraft,
  updateWeeklyRows,
  type MealKey,
  type MealTimeField,
} from './availabilityScheduleDraftDomain';
import { defaultOverrideRow, defaultWeeklyRows } from './availabilityScheduleManagerUtils';

import type {
  AvailabilityScheduleDraftState,
  AvailabilityScheduleValidationResult,
} from './availabilityScheduleManagerDomain';
import type { DayErrors } from './availabilityScheduleValidation';
import type { DayServiceConfig } from './servicePeriodsMapper';
import type { TurnBandRowError } from './turnBandsDomain';
import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from './types';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { ServicePeriodRow, TurnBandInput, TurnBandsPayload } from '@/services/ops/restaurants';

type UseAvailabilityScheduleDraftOptions = {
  onDraftChanged: () => void;
};

export function useAvailabilityScheduleDraft({
  onDraftChanged,
}: UseAvailabilityScheduleDraftOptions) {
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
  const [hasInitialized, setHasInitialized] = useState(false);

  const hasLocalChanges = hoursDirty || servicesDirty || occasionsDirty || turnBandsDirty;

  const initializeDraftState = useCallback((draftState: AvailabilityScheduleDraftState) => {
    setWeeklyRows(draftState.weeklyRows);
    setOverrideRows(draftState.overrideRows);
    setDayConfigs(draftState.dayConfigs);
    setCustomRows(draftState.customRows);
    setOccasionDrafts(draftState.occasionDrafts);
    setTurnBandsDraft(draftState.turnBandsDraft);
    setTurnBandErrors({});
    setWeeklyErrors({});
    setOverrideErrors([]);
    setServiceErrors({});
    setHoursDirty(false);
    setServicesDirty(false);
    setOccasionsDirty(false);
    setTurnBandsDirty(false);
    setHasInitialized(true);
  }, []);

  const applyValidationResult = useCallback((validation: AvailabilityScheduleValidationResult) => {
    setWeeklyErrors(validation.weeklyErrors);
    setOverrideErrors(validation.overrideErrors);
    setServiceErrors(validation.serviceErrors);
    setTurnBandErrors(validation.turnBandErrors);
  }, []);

  const handleWeeklyChange = useCallback(
    (dayIndex: number, patch: Partial<WeeklyRow>) => {
      setWeeklyRows((current) => updateWeeklyRows(current, dayIndex, patch));
      setDayConfigs((current) => updateDayConfigsForWeeklyPatch(current, dayIndex, patch));
      setWeeklyErrors((prev) => clearWeeklyError(prev, dayIndex));
      setServiceErrors((prev) => clearServiceErrorsForDay(prev, dayIndex));
      setHoursDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const handleOverrideChange = useCallback(
    (index: number, patch: Partial<OverrideRow>) => {
      setOverrideRows((current) => updateOverrideRows(current, index, patch));
      setOverrideErrors((prev) => clearOverrideErrorAtIndex(prev, index));
      setHoursDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const addOverride = useCallback(() => {
    setOverrideRows((current) => [...current, defaultOverrideRow()]);
    setOverrideErrors((current) => [...current, {}]);
    setHoursDirty(true);
    onDraftChanged();
  }, [onDraftChanged]);

  const removeOverride = useCallback(
    (index: number) => {
      setOverrideRows((current) => removeOverrideAtIndex(current, index));
      setOverrideErrors((current) => removeOverrideAtIndex(current, index));
      setHoursDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const handleMealToggle = useCallback(
    (dayIndex: number, mealKey: MealKey, value: boolean) => {
      setDayConfigs((current) => updateMealEnabled(current, dayIndex, mealKey, value));
      setServiceErrors((prev) => clearServiceMealError(prev, dayIndex, mealKey));
      setServicesDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const handleMealTimeChange = useCallback(
    (dayIndex: number, mealKey: MealKey, field: MealTimeField, value: string) => {
      setDayConfigs((current) => updateMealTime(current, dayIndex, mealKey, field, value));
      setServiceErrors((prev) => clearServiceMealTimeError(prev, dayIndex, mealKey, field));
      setServicesDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const handleOccasionsChange = useCallback(
    (nextOccasions: OpsOccasion[]) => {
      setOccasionDrafts(nextOccasions);
      setOccasionsDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const handleTurnBandsChange = useCallback(
    (optionKey: string, nextBands: TurnBandInput[]) => {
      setTurnBandsDraft((current) => updateTurnBandsDraft(current, optionKey, nextBands));
      setTurnBandErrors((prev) => clearTurnBandErrors(prev, optionKey));
      setTurnBandsDirty(true);
      onDraftChanged();
    },
    [onDraftChanged],
  );

  const actions = useMemo(
    () => ({
      addOverride,
      applyValidationResult,
      handleMealTimeChange,
      handleMealToggle,
      handleOccasionsChange,
      handleOverrideChange,
      handleTurnBandsChange,
      handleWeeklyChange,
      initializeDraftState,
      markHoursSaved: () => setHoursDirty(false),
      markOccasionsSaved: () => setOccasionsDirty(false),
      markServicesSaved: () => setServicesDirty(false),
      markTurnBandsSaved: () => setTurnBandsDirty(false),
      removeOverride,
      replaceTurnBandsDraft: (nextDraft: TurnBandsPayload) => setTurnBandsDraft(nextDraft),
    }),
    [
      addOverride,
      applyValidationResult,
      handleMealTimeChange,
      handleMealToggle,
      handleOccasionsChange,
      handleOverrideChange,
      handleTurnBandsChange,
      handleWeeklyChange,
      initializeDraftState,
      removeOverride,
    ],
  );

  return {
    addOverride: actions.addOverride,
    applyValidationResult: actions.applyValidationResult,
    customRows,
    dayConfigs,
    handleMealTimeChange: actions.handleMealTimeChange,
    handleMealToggle: actions.handleMealToggle,
    handleOccasionsChange: actions.handleOccasionsChange,
    handleOverrideChange: actions.handleOverrideChange,
    handleTurnBandsChange: actions.handleTurnBandsChange,
    handleWeeklyChange: actions.handleWeeklyChange,
    hasInitialized,
    hasLocalChanges,
    hoursDirty,
    initializeDraftState: actions.initializeDraftState,
    markHoursSaved: actions.markHoursSaved,
    markOccasionsSaved: actions.markOccasionsSaved,
    markServicesSaved: actions.markServicesSaved,
    markTurnBandsSaved: actions.markTurnBandsSaved,
    occasionDrafts,
    occasionsDirty,
    overrideErrors,
    overrideRows,
    removeOverride: actions.removeOverride,
    replaceTurnBandsDraft: actions.replaceTurnBandsDraft,
    serviceErrors,
    servicesDirty,
    turnBandErrors,
    turnBandsDirty,
    turnBandsDraft,
    weeklyErrors,
    weeklyRows,
  };
}

export type AvailabilityScheduleDraftController = ReturnType<typeof useAvailabilityScheduleDraft>;
