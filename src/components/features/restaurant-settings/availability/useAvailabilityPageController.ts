'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { useOpsOccasions } from '@/hooks/ops/useOccasions';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';

import { emitProfileAnalytics } from '../../../../../components/ops/restaurants/details/shared';
// Relative on purpose: vitest resolves `@/hooks/ops/*` through a per-file alias list
// (vitest.config.ts), which does not include this new hook yet.
import {
  useOpsAvailability,
  useOpsSaveAvailability,
} from '../../../../hooks/ops/useOpsSaveAvailability';
import { buildAvailabilityDraftOverrides } from '../availabilityScheduleManagerDomain';
import { extractRequiredOccasionKeys } from '../availabilityScheduleManagerUtils';
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
import {
  AVAILABILITY_CATALOG_REMOVAL_STEP_NAME,
  AVAILABILITY_CATALOG_STEP_NAME,
} from './availabilitySaveErrorCopy';
import { planAvailabilitySave } from './availabilitySavePlan';
import { useSaveAvailabilityOccasions } from './useSaveAvailabilityOccasions';
import {
  formatSettingsSectionList,
  getSettingsSaveReasonCode,
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
      // The restaurant-owned part of Booking types and table times. Booking types themselves are
      // merged by the catalog steps (`mergeCatalog`).
      return {
        ...target,
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

/**
 * Booking types after a catalog step: after creates and updates, every draft type is saved and
 * types waiting to be deleted are still there; after deletes, the saved list is the draft's.
 */
function mergeCatalog(
  target: AvailabilityPageDraft,
  source: AvailabilityPageDraft,
  phase: 'upserts' | 'deletes',
): AvailabilityPageDraft {
  if (phase === 'deletes') {
    return { ...target, occasions: source.occasions };
  }
  const draftKeys = new Set(source.occasions.map((occasion) => occasion.key));
  return {
    ...target,
    occasions: [
      ...source.occasions,
      ...target.occasions.filter((occasion) => !draftKeys.has(occasion.key)),
    ],
  };
}

export type AvailabilityPageControllerOptions = {
  /**
   * Nabatable platform admin (session hint). Only they may change the global booking types;
   * everyone else saves hours, meal times, table times and booking rules only.
   */
  canEditCatalog?: boolean;
};

export function useAvailabilityPageController(
  restaurantId: string | null,
  { canEditCatalog = false }: AvailabilityPageControllerOptions = {},
) {
  // Hours, meal times, table times and booking rules come from ONE snapshot with the revision of
  // exactly those rows, never from the single-resource caches (which can be older or newer than a
  // separately fetched revision). The profile supplies only the fields the snapshot has no copy of.
  const availabilityQuery = useOpsAvailability(restaurantId);
  const occasionsQuery = useOpsOccasions();
  const profileQuery = useOpsRestaurantDetails(restaurantId);
  const saveAvailability = useOpsSaveAvailability(restaurantId);
  const saveOccasions = useSaveAvailabilityOccasions();
  const saveSequence = useSettingsSaveSequence();

  const [saved, setSaved] = useState<AvailabilityPageDraft | null>(null);
  const [draft, setDraft] = useState<AvailabilityPageDraft | null>(null);
  /** Revision of the settings `saved` was built from; sent as the save precondition. */
  const [savedRevision, setSavedRevision] = useState<string | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);

  const snapshot = availabilityQuery.data ?? null;
  const sources = useMemo(() => {
    if (!snapshot || !occasionsQuery.data || !profileQuery.data) {
      return null;
    }
    return {
      revision: snapshot.revision,
      operatingHours: snapshot.hours,
      servicePeriods: snapshot.servicePeriods,
      occasions: occasionsQuery.data,
      turnBands: snapshot.turnBands,
      profile: {
        ...profileQuery.data,
        reservationIntervalMinutes: snapshot.rules.reservationIntervalMinutes,
        reservationDefaultDurationMinutes: snapshot.rules.reservationDefaultDurationMinutes,
        reservationLastSeatingBufferMinutes: snapshot.rules.reservationLastSeatingBufferMinutes,
        reservationLifecycleGraceMinutes: snapshot.rules.reservationLifecycleGraceMinutes,
        bookingPolicy: snapshot.rules.bookingPolicy,
      },
    };
  }, [occasionsQuery.data, profileQuery.data, snapshot]);

  const dirtyGroups = useMemo(
    () => (saved && draft ? getDirtyAvailabilityGroups(saved, draft) : []),
    [draft, saved],
  );
  const isDirty = dirtyGroups.length > 0;

  // Seed from the server, and re-seed when saved data changes while nothing is unsaved. The
  // revision is taken in the same step from the same snapshot, then held while the draft is dirty,
  // so a save made from older data is refused (STALE_WRITE) instead of overwriting newer settings.
  useEffect(() => {
    if (!sources || saveSequence.isSaving || isDirty) {
      return;
    }
    const next = buildAvailabilityPageDraft(sources);
    setSaved(next);
    setDraft(next);
    setSavedRevision(sources.revision);
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
      const plan = planAvailabilitySave({
        saved: base,
        draft: sent,
        canEditCatalog,
        savedServicePeriods: snapshot?.servicePeriods ?? [],
        expectedRevision: savedRevision,
      });
      const steps: SettingsSaveStep[] = [];

      if (plan.catalog.upserts) {
        steps.push({
          id: 'booking-types',
          name: AVAILABILITY_CATALOG_STEP_NAME,
          run: async () => {
            await saveOccasions({
              draftOccasions: sent.occasions,
              originalOccasions: base.occasions,
              phase: 'upserts',
            });
            setSaved((current) => (current ? mergeCatalog(current, sent, 'upserts') : current));
          },
        });
      }

      const command = plan.command;
      if (command) {
        const rulesFields = command.rules ? Object.keys(command.rules) : [];
        steps.push({
          id: 'availability',
          name: formatSettingsSectionList(
            plan.commandGroups.map((group) => AVAILABILITY_SAVE_GROUP_NAMES[group]),
          ),
          run: async () => {
            try {
              const result = await saveAvailability.mutateAsync(command);
              setSavedRevision(result.revision);
              if (rulesFields.length > 0) {
                emitProfileAnalytics('restaurant_profile_section_saved', {
                  restaurant_id: restaurantId,
                  section: 'booking_rules',
                  changed_field_count: rulesFields.length,
                  changed_fields: rulesFields,
                  saved_at: result.rules.updatedAt ?? null,
                });
              }
            } catch (error) {
              if (rulesFields.length > 0) {
                emitProfileAnalytics('restaurant_profile_section_save_failed', {
                  restaurant_id: restaurantId,
                  section: 'booking_rules',
                  field_count: rulesFields.length,
                  code: getSettingsSaveReasonCode(error),
                });
              }
              throw error;
            }
            setSaved((current) =>
              current
                ? plan.commandGroups.reduce((next, group) => mergeGroup(next, sent, group), current)
                : current,
            );
          },
        });
      }

      if (plan.catalog.deletes) {
        steps.push({
          id: 'booking-types-removed',
          name: AVAILABILITY_CATALOG_REMOVAL_STEP_NAME,
          run: async () => {
            await saveOccasions({
              draftOccasions: sent.occasions,
              originalOccasions: base.occasions,
              phase: 'deletes',
            });
            setSaved((current) => (current ? mergeCatalog(current, sent, 'deletes') : current));
          },
        });
      }

      return steps;
    },
    [
      canEditCatalog,
      restaurantId,
      saveAvailability,
      saveOccasions,
      savedRevision,
      snapshot?.servicePeriods,
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
    const steps = buildSteps(draft, saved);
    if (steps.length === 0) {
      // Only changes this user may not save (booking types without platform access) remain.
      return { ok: false as const, blockedBy: null };
    }
    const outcome = await saveSequence.run(steps);
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

  const settingsQueries = [availabilityQuery, occasionsQuery, profileQuery];
  // Only a query that never loaded blocks the page; a failed background refresh keeps the
  // loaded page and its unsaved edits, and is reported as `refreshError` instead.
  const loadError = settingsQueries.find((query) => query.error && !query.data)?.error ?? null;
  const refreshError = settingsQueries.find((query) => query.error && query.data)?.error ?? null;
  const retryLoad = useCallback(() => {
    for (const query of [availabilityQuery, occasionsQuery, profileQuery]) {
      if (query.error) {
        void query.refetch();
      }
    }
  }, [availabilityQuery, occasionsQuery, profileQuery]);

  const lastSavedAt = useMemo(() => {
    const stamps = [
      snapshot?.hours.updatedAt,
      ...(snapshot?.servicePeriods ?? []).map((row) => row.updatedAt),
    ].filter((value): value is string => Boolean(value));
    return stamps.sort().at(-1) ?? null;
  }, [snapshot]);

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
    savedServicePeriods: snapshot?.servicePeriods ?? [],
    turnBandDefaults: snapshot?.turnBands.defaults,
    googleDrift: gbpDrift,
    canEditCatalog,
  };
}

export type AvailabilityPageController = ReturnType<typeof useAvailabilityPageController>;
