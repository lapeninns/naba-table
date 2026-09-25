'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useOccasionService } from '@/contexts/ops-services';
import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import {
  useOpsRestaurantDetails,
  useOpsUpdateRestaurantDetails,
} from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks/ops/useOpsServicePeriods';
import { useOpsTurnBands, useOpsUpdateTurnBands } from '@/hooks/ops/useOpsTurnBands';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { queryKeys } from '@/lib/query/keys';

import { emitProfileAnalytics } from '../../../../../components/ops/restaurants/details/shared';
import { buildAvailabilityDraftOverrides } from '../availabilityScheduleManagerDomain';
import { persistAvailabilityOccasionDrafts } from '../availabilityScheduleManagerPersistence';
import {
  buildOperatingHoursPayload,
  extractRequiredOccasionKeys,
} from '../availabilityScheduleManagerUtils';
import {
  buildAvailabilityServicePayload,
  buildAvailabilityTurnBandsPayload,
} from '../availabilitySchedulePayloadDomain';
import {
  AVAILABILITY_SAVE_GROUP_NAMES,
  buildAvailabilityPageDraft,
  describeAvailabilityChanges,
  getDirtyAvailabilityGroups,
  type AvailabilityPageDraft,
  type AvailabilitySaveGroup,
} from './availabilityPageDraft';
import {
  orderAvailabilityErrorKeys,
  validateAvailabilityDraft,
  type AvailabilityErrors,
} from './availabilityPageValidation';
import { useOptionalGbpDrift } from '../gbp-drift/useGbpDrift';
import { useWorkspaceGbpDriftCheck } from '../gbpDriftBadges';
import { RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS } from '../routes';
import { planAvailabilitySave } from './availabilitySavePlan';
import {
  formatSettingsSectionList,
  pluralise,
  useSettingsSaveSequence,
  type SettingsSaveStep,
} from '../shared/settingsSaveSequence';

const DRIFT_SECTIONS = ['operatingHours', 'servicePeriods'] as const;

/**
 * Errors show once any field in their group has been touched: a weekday (`w2-…`), a special
 * date (`o-<id>-…`), or a single booking rule.
 */
export function availabilityErrorGroup(key: string): string {
  const weekday = /^w\d-/.exec(key);
  if (weekday) {
    return weekday[0];
  }
  if (key.startsWith('o-')) {
    return key.slice(0, key.lastIndexOf('-'));
  }
  return key;
}

function mergeGroup(
  target: AvailabilityPageDraft,
  source: AvailabilityPageDraft,
  group: AvailabilitySaveGroup,
): AvailabilityPageDraft {
  switch (group) {
    case 'types':
      return {
        ...target,
        occasions: source.occasions,
        turnBands: source.turnBands,
        rules: {
          ...target.rules,
          reservationDefaultDurationMinutes: source.rules.reservationDefaultDurationMinutes,
        },
      };
    case 'hours':
      return { ...target, weeklyRows: source.weeklyRows, overrideRows: source.overrideRows };
    case 'meals':
      return { ...target, dayConfigs: source.dayConfigs, customRows: source.customRows };
    case 'rules':
      return {
        ...target,
        rules: {
          ...source.rules,
          reservationDefaultDurationMinutes: target.rules.reservationDefaultDurationMinutes,
        },
      };
  }
}

export function useAvailabilityPageController(restaurantId: string | null) {
  const queryClient = useQueryClient();
  const occasionService = useOccasionService();
  const operatingHoursQuery = useOpsOperatingHours(restaurantId);
  const servicePeriodsQuery = useOpsServicePeriods(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const turnBandsQuery = useOpsTurnBands(restaurantId);
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const updateOperatingHours = useOpsUpdateOperatingHours(restaurantId);
  const updateServicePeriods = useOpsUpdateServicePeriods(restaurantId);
  const updateTurnBands = useOpsUpdateTurnBands(restaurantId);
  const updateRestaurantDetails = useOpsUpdateRestaurantDetails(restaurantId);
  const saveSequence = useSettingsSaveSequence();

  const [saved, setSaved] = useState<AvailabilityPageDraft | null>(null);
  const [draft, setDraft] = useState<AvailabilityPageDraft | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);

  const sources = useMemo(() => {
    if (
      !operatingHoursQuery.data ||
      !servicePeriodsQuery.data ||
      !occasionsQuery.data ||
      !turnBandsQuery.data ||
      !profileQuery.data
    ) {
      return null;
    }
    return {
      operatingHours: operatingHoursQuery.data,
      servicePeriods: servicePeriodsQuery.data,
      occasions: occasionsQuery.data,
      turnBands: turnBandsQuery.data,
      profile: profileQuery.data,
    };
  }, [
    occasionsQuery.data,
    operatingHoursQuery.data,
    profileQuery.data,
    servicePeriodsQuery.data,
    turnBandsQuery.data,
  ]);

  const dirtyGroups = useMemo(
    () => (saved && draft ? getDirtyAvailabilityGroups(saved, draft) : []),
    [draft, saved],
  );
  const isDirty = dirtyGroups.length > 0;

  // Seed from the server, and re-seed when saved data changes while nothing is unsaved.
  useEffect(() => {
    if (!sources || saveSequence.isSaving || isDirty) {
      return;
    }
    const next = buildAvailabilityPageDraft(sources);
    setSaved(next);
    setDraft(next);
  }, [isDirty, saveSequence.isSaving, sources]);

  const errors: AvailabilityErrors = useMemo(
    () => (draft ? validateAvailabilityDraft(draft, dirtyGroups) : {}),
    [dirtyGroups, draft],
  );
  const orderedErrorKeys = useMemo(() => orderAvailabilityErrorKeys(errors), [errors]);
  const visibleErrors = useMemo(() => {
    if (showAllErrors) {
      return errors;
    }
    const touchedGroups = new Set([...touched].map(availabilityErrorGroup));
    return Object.fromEntries(
      Object.entries(errors).filter(
        ([key]) => key === 'types-required' || touchedGroups.has(availabilityErrorGroup(key)),
      ),
    );
  }, [errors, showAllErrors, touched]);

  const changeGroups = useMemo(
    () => (saved && draft ? describeAvailabilityChanges(saved, draft) : []),
    [draft, saved],
  );
  const changeCount = changeGroups.reduce((total, group) => total + group.changes.length, 0);

  const updateDraft = useCallback(
    (updater: (current: AvailabilityPageDraft) => AvailabilityPageDraft) => {
      setDraft((current) => (current ? updater(current) : current));
      saveSequence.clearFailure();
    },
    [saveSequence],
  );

  const markTouched = useCallback((key: string) => {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
  }, []);

  const discard = useCallback(() => {
    setDraft(saved);
    setTouched(new Set());
    setShowAllErrors(false);
    saveSequence.clearFailure();
    toast.success('Changes discarded. Showing your saved settings.');
  }, [saveSequence, saved]);

  const buildSteps = useCallback(
    (sent: AvailabilityPageDraft, base: AvailabilityPageDraft): SettingsSaveStep[] => {
      const occasionKeys = extractRequiredOccasionKeys(sent.occasions);
      const commit = (group: AvailabilitySaveGroup) =>
        setSaved((current) => (current ? mergeGroup(current, sent, group) : current));

      const runners: Record<AvailabilitySaveGroup, () => Promise<void>> = {
        types: async () => {
          // The default table time is edited here but stored on the restaurant record. It is written
          // first: repeating it is harmless if a later part of this step fails and staff retry.
          if (
            sent.rules.reservationDefaultDurationMinutes !==
            base.rules.reservationDefaultDurationMinutes
          ) {
            const changedFields = ['reservationDefaultDurationMinutes'];
            try {
              const profile = await updateRestaurantDetails.mutateAsync({
                reservationDefaultDurationMinutes: Number.parseInt(
                  sent.rules.reservationDefaultDurationMinutes,
                  10,
                ),
              });
              emitProfileAnalytics('restaurant_profile_section_saved', {
                restaurant_id: restaurantId,
                section: 'booking_rules',
                changed_field_count: changedFields.length,
                changed_fields: changedFields,
                saved_at: profile.updatedAt ?? null,
              });
            } catch (error) {
              emitProfileAnalytics('restaurant_profile_section_save_failed', {
                restaurant_id: restaurantId,
                section: 'booking_rules',
                field_count: changedFields.length,
                code: error instanceof Error ? error.name : 'unknown',
              });
              throw error;
            }
          }
          await persistAvailabilityOccasionDrafts({
            draftOccasions: sent.occasions,
            occasionService,
            originalOccasions: base.occasions,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });
          if (JSON.stringify(sent.turnBands) !== JSON.stringify(base.turnBands)) {
            await updateTurnBands.mutateAsync(
              buildAvailabilityTurnBandsPayload({
                occasionDrafts: sent.occasions,
                servicePeriods: servicePeriodsQuery.data ?? [],
                turnBandsDraft: sent.turnBands,
              }),
            );
          }
          commit('types');
        },
        hours: async () => {
          await updateOperatingHours.mutateAsync(
            buildOperatingHoursPayload(sent.weeklyRows, sent.overrideRows),
          );
          commit('hours');
        },
        meals: async () => {
          await updateServicePeriods.mutateAsync(
            buildAvailabilityServicePayload({
              customRows: sent.customRows,
              dayConfigs: sent.dayConfigs,
              occasionKeys: {
                lunch: occasionKeys.lunch ?? 'lunch',
                dinner: occasionKeys.dinner ?? 'dinner',
              },
            }),
          );
          commit('meals');
        },
        rules: async () => {
          // The default table time saves with Booking types and table times.
          const changedFields = (Object.keys(sent.rules) as Array<keyof typeof sent.rules>).filter(
            (field) =>
              field !== 'reservationDefaultDurationMinutes' &&
              sent.rules[field] !== base.rules[field],
          );
          try {
            const trimmedPolicy = sent.rules.bookingPolicy.trim();
            const profile = await updateRestaurantDetails.mutateAsync({
              bookingPolicy: trimmedPolicy.length > 0 ? trimmedPolicy : null,
              reservationIntervalMinutes: Number.parseInt(
                sent.rules.reservationIntervalMinutes,
                10,
              ),
              reservationLastSeatingBufferMinutes: Number.parseInt(
                sent.rules.reservationLastSeatingBufferMinutes,
                10,
              ),
              reservationLifecycleGraceMinutes: Number.parseInt(
                sent.rules.reservationLifecycleGraceMinutes,
                10,
              ),
            });
            emitProfileAnalytics('restaurant_profile_section_saved', {
              restaurant_id: restaurantId,
              section: 'booking_rules',
              changed_field_count: changedFields.length,
              changed_fields: changedFields,
              saved_at: profile.updatedAt ?? null,
            });
          } catch (error) {
            emitProfileAnalytics('restaurant_profile_section_save_failed', {
              restaurant_id: restaurantId,
              section: 'booking_rules',
              field_count: changedFields.length,
              code: error instanceof Error ? error.name : 'unknown',
            });
            throw error;
          }
          commit('rules');
        },
      };

      return planAvailabilitySave(base, sent).map((group) => ({
        id: group,
        name: AVAILABILITY_SAVE_GROUP_NAMES[group],
        run: runners[group],
      }));
    },
    [
      occasionService,
      queryClient,
      restaurantId,
      servicePeriodsQuery.data,
      updateOperatingHours,
      updateRestaurantDetails,
      updateServicePeriods,
      updateTurnBands,
    ],
  );

  const firstIssueKey = orderedErrorKeys[0] ?? null;

  const save = useCallback(async () => {
    if (!saved || !draft || !isDirty || saveSequence.isSaving) {
      return { ok: false as const, blockedBy: null };
    }
    if (firstIssueKey) {
      setShowAllErrors(true);
      return { ok: false as const, blockedBy: firstIssueKey };
    }
    const outcome = await saveSequence.run(buildSteps(draft, saved));
    if (outcome?.ok) {
      setTouched(new Set());
      setShowAllErrors(false);
      toast.success(
        `Saved ${formatSettingsSectionList(outcome.saved)}. Guests can request the new times from now on.`,
      );
    }
    return { ok: Boolean(outcome?.ok), blockedBy: null };
  }, [buildSteps, draft, firstIssueKey, isDirty, saveSequence, saved]);

  useRegisterOpsUnsavedChanges(
    RESTAURANT_SETTINGS_UNSAVED_ENTRY_IDS.availability,
    isDirty,
    `You have ${pluralise(changeCount, 'unsaved change')} on the Availability page. If you leave now, they’ll be lost.`,
  );

  // Google drift: compare Google against the draft, as the rest of settings does.
  const registryDrift = useOptionalGbpDrift();
  const registerDriftDraftOverride = registryDrift?.registerDraftOverride;
  const clearDriftDraftOverrides = registryDrift?.clearDraftOverrides;
  const registeredDriftKeysRef = useRef<Set<string>>(new Set());
  const gbpDrift = useWorkspaceGbpDriftCheck({ restaurantId, sectionKeys: DRIFT_SECTIONS });
  const servicePeriodDriftFields = gbpDrift.getFieldsBySection('servicePeriods');
  // Registering overrides changes the drift fields, which rebuilds this list; keying the effect on
  // its content (not its identity) stops that from looping.
  const driftOverridesSignature = JSON.stringify(
    draft
      ? buildAvailabilityDraftOverrides({
          dayConfigs: draft.dayConfigs,
          occasionKeys: extractRequiredOccasionKeys(draft.occasions),
          servicePeriodDriftFields,
          weeklyRows: draft.weeklyRows,
        })
      : [],
  );
  useEffect(() => {
    if (!registerDriftDraftOverride) return;
    const driftOverrides = JSON.parse(driftOverridesSignature) as Array<[string, unknown]>;
    const nextKeys = new Set(driftOverrides.map(([fieldKey]) => fieldKey));
    const stale = [...registeredDriftKeysRef.current].filter((key) => !nextKeys.has(key));
    if (stale.length > 0) {
      clearDriftDraftOverrides?.(stale);
    }
    for (const [fieldKey, value] of driftOverrides) {
      registerDriftDraftOverride(fieldKey, value);
    }
    registeredDriftKeysRef.current = nextKeys;
    return () => {
      if (nextKeys.size > 0) {
        clearDriftDraftOverrides?.([...nextKeys]);
      }
    };
  }, [clearDriftDraftOverrides, driftOverridesSignature, registerDriftDraftOverride]);

  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled: isDirty && !saveSequence.isSaving,
      when: () => true,
      handler: () => {
        void save();
      },
    },
  ]);

  const settingsQueries = [
    operatingHoursQuery,
    servicePeriodsQuery,
    occasionsQuery,
    turnBandsQuery,
    profileQuery,
  ];
  // Only a query that never loaded blocks the page; a failed background refresh keeps the
  // loaded page and its unsaved edits, and is reported as `refreshError` instead.
  const loadError = settingsQueries.find((query) => query.error && !query.data)?.error ?? null;
  const refreshError = settingsQueries.find((query) => query.error && query.data)?.error ?? null;
  const retryLoad = useCallback(() => {
    for (const query of [
      operatingHoursQuery,
      servicePeriodsQuery,
      occasionsQuery,
      turnBandsQuery,
      profileQuery,
    ]) {
      if (query.error) {
        void query.refetch();
      }
    }
  }, [occasionsQuery, operatingHoursQuery, profileQuery, servicePeriodsQuery, turnBandsQuery]);

  const lastSavedAt = useMemo(() => {
    const stamps = [
      operatingHoursQuery.data?.updatedAt,
      ...(servicePeriodsQuery.data ?? []).map((row) => row.updatedAt),
    ].filter((value): value is string => Boolean(value));
    return stamps.sort().at(-1) ?? null;
  }, [operatingHoursQuery.data?.updatedAt, servicePeriodsQuery.data]);

  return {
    saved,
    draft,
    updateDraft,
    dirtyGroups,
    isDirty,
    changeGroups,
    changeCount,
    errors,
    visibleErrors,
    orderedErrorKeys,
    markTouched,
    showAllErrors: () => setShowAllErrors(true),
    save,
    discard,
    saveProgress: saveSequence.progress,
    saveFailure: saveSequence.failure,
    isSaving: saveSequence.isSaving,
    isLoading: !draft && !loadError,
    loadError,
    refreshError,
    retryLoad,
    lastSavedAt,
    timezone: profileQuery.data?.timezone ?? 'Europe/London',
    savedServicePeriods: servicePeriodsQuery.data ?? [],
    turnBandDefaults: turnBandsQuery.data?.defaults,
    googleDrift: gbpDrift,
  };
}

export type AvailabilityPageController = ReturnType<typeof useAvailabilityPageController>;
