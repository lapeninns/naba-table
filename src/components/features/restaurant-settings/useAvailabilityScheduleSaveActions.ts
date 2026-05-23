import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useOccasionService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import { validateAvailabilityScheduleDraft } from './availabilityScheduleManagerDomain';
import { persistAvailabilityOccasionDrafts } from './availabilityScheduleManagerPersistence';
import {
  buildMissingRequiredOccasions,
  buildOperatingHoursPayload,
} from './availabilityScheduleManagerUtils';
import {
  buildAvailabilityServicePayload,
  buildAvailabilityTurnBandsPayload,
} from './availabilitySchedulePayloadDomain';

import type { AvailabilitySaveState } from './AvailabilityScheduleManagerChrome';
import type { AvailabilityScheduleDraftController } from './useAvailabilityScheduleDraft';
import type { OpsOccasion } from '@/services/ops/occasions';
import type {
  OperatingHoursSnapshot,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';

type RequiredOccasionKeys = {
  lunch?: string;
  dinner?: string;
};

type AvailabilityMutation<TVariables, TResult> = {
  readonly isPending: boolean;
  mutateAsync(variables: TVariables): Promise<TResult>;
};

type UseAvailabilityScheduleSaveActionsOptions = {
  draft: AvailabilityScheduleDraftController;
  hasRequiredOccasions: boolean;
  occasionKeys: RequiredOccasionKeys;
  originalOccasions: readonly OpsOccasion[];
  servicePeriods: readonly ServicePeriodRow[];
  setSaveState: (state: AvailabilitySaveState) => void;
  updateOperatingHours: AvailabilityMutation<OperatingHoursSnapshot, OperatingHoursSnapshot>;
  updateServicePeriods: AvailabilityMutation<readonly ServicePeriodRow[], ServicePeriodRow[]>;
  updateTurnBands: AvailabilityMutation<TurnBandsPayload, TurnBandsSnapshot>;
};

export function useAvailabilityScheduleSaveActions({
  draft,
  hasRequiredOccasions,
  occasionKeys,
  originalOccasions,
  servicePeriods,
  setSaveState,
  updateOperatingHours,
  updateServicePeriods,
  updateTurnBands,
}: UseAvailabilityScheduleSaveActionsOptions) {
  const occasionService = useOccasionService();
  const queryClient = useQueryClient();
  const [isSavingConfiguration, setIsSavingConfiguration] = useState(false);

  const createRequiredOccasions = useCallback(async () => {
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
  }, [occasionKeys, occasionService, queryClient, setSaveState]);

  const handleSave = useCallback(async () => {
    if (!draft.hasLocalChanges) {
      return;
    }

    const validation = validateAvailabilityScheduleDraft({
      dayConfigs: draft.dayConfigs,
      overrideRows: draft.overrideRows,
      turnBandsDraft: draft.turnBandsDraft,
      weeklyRows: draft.weeklyRows,
    });

    draft.applyValidationResult(validation);

    if (!validation.isValid) {
      setSaveState({
        variant: 'destructive',
        title: 'Review highlighted fields',
        message:
          'Fix validation issues in the schedule, overrides, or dining-duration bands before saving.',
      });
      return;
    }

    if (draft.servicesDirty && !hasRequiredOccasions) {
      setSaveState({
        variant: 'destructive',
        title: 'Missing booking types',
        message: 'Create active Lunch and Dinner booking types before saving service windows.',
      });
      return;
    }

    const operatingHoursPayload = buildOperatingHoursPayload(draft.weeklyRows, draft.overrideRows);
    const servicePayload = draft.servicesDirty
      ? buildAvailabilityServicePayload({
          customRows: draft.customRows,
          dayConfigs: draft.dayConfigs,
          occasionKeys: {
            lunch: occasionKeys.lunch!,
            dinner: occasionKeys.dinner!,
          },
        })
      : [];

    let hoursSaved = false;
    const savedSections: string[] = [];

    try {
      setIsSavingConfiguration(true);
      if (draft.hoursDirty) {
        await updateOperatingHours.mutateAsync(operatingHoursPayload);
        hoursSaved = true;
        draft.markHoursSaved();
        savedSections.push('Weekly hours and overrides: saved');
      }

      if (draft.servicesDirty) {
        await updateServicePeriods.mutateAsync(servicePayload);
        draft.markServicesSaved();
        savedSections.push('Service windows: saved');
      }

      if (draft.occasionsDirty) {
        await persistAvailabilityOccasionDrafts({
          draftOccasions: draft.occasionDrafts,
          occasionService,
          originalOccasions,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });
        draft.markOccasionsSaved();
        savedSections.push('Booking types: saved');
      }

      if (draft.turnBandsDirty) {
        const bandsPayload = buildAvailabilityTurnBandsPayload({
          occasionDrafts: draft.occasionDrafts,
          servicePeriods,
          turnBandsDraft: draft.turnBandsDraft,
        });

        const snapshot = await updateTurnBands.mutateAsync(bandsPayload);
        draft.replaceTurnBandsDraft(snapshot.bands ?? {});
        draft.markTurnBandsSaved();
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
  }, [
    draft,
    hasRequiredOccasions,
    occasionKeys,
    occasionService,
    originalOccasions,
    queryClient,
    servicePeriods,
    setSaveState,
    updateOperatingHours,
    updateServicePeriods,
    updateTurnBands,
  ]);

  const isSaving =
    isSavingConfiguration ||
    updateOperatingHours.isPending ||
    updateServicePeriods.isPending ||
    updateTurnBands.isPending;

  return {
    createRequiredOccasions,
    handleSave,
    isSaving,
  };
}
