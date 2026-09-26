'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useRegisterOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { getFieldErrors } from '@/lib/http/userMessage';

import { emitProfileAnalytics } from '../../../../../../components/ops/restaurants/details/shared';
import {
  buildProfileCompletionAnalytics,
  filterErrors,
  mapInitialValues,
  mapRestaurantProfileValues,
  pickDraftValues,
  validateRestaurantDetails,
  type DetailsField,
  type FormErrors,
  type FormState,
  type RestaurantDetailsFormValues,
} from '../../../../../../components/ops/restaurants/restaurantDetailsFormModel';
import { buildProfileValues } from '../../restaurantProfileModel';
import {
  formatSettingsSectionList,
  useSettingsSaveSequence,
  type SettingsChangeGroup,
  type SettingsSaveStep,
} from '../../shared';
import {
  PROFILE_FIELD_DOM_IDS,
  PROFILE_FIELD_LABELS,
  focusProfileElement,
  type ProfileSectionDefinition,
  type ProfileSectionId,
} from '../profileSections';

import type { RestaurantProfile } from '@/services/ops/restaurants';

type UpdateProfile = (payload: Partial<RestaurantProfile>) => Promise<RestaurantProfile>;

type UseProfileDraftInput = {
  restaurantId: string;
  profile: RestaurantProfile;
  updateProfile: UpdateProfile;
  /** The sections this page edits; only their fields are drafted, validated and saved. */
  sections: readonly ProfileSectionDefinition[];
  /** Unsaved-changes registry id, so the settings sidebar can mark this page "Unsaved". */
  unsavedEntryId: string;
  /** Shown when leaving the page with unsaved changes. */
  leaveMessage: string;
  /** Fires `restaurant_profile_save_all_clicked` with the sections about to be saved. */
  onSaveRequested?: (sectionIds: readonly ProfileSectionId[]) => void;
};

export type ProfileSectionStatus = {
  section: ProfileSectionDefinition;
  isDirty: boolean;
  /** Issues currently shown on the page for this section. */
  visibleIssueCount: number;
};

function formatChangeValue(value: FormState[DetailsField]): string {
  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }
  return value.trim() ? value : 'Empty';
}

/** Server field errors, each shown until the user changes the value it was reported for. */
type ServerFieldErrors = {
  errors: FormErrors;
  values: Partial<FormState>;
};

const NO_SERVER_ERRORS: ServerFieldErrors = { errors: {}, values: {} };

function toServerFieldErrors(
  error: unknown,
  fields: readonly DetailsField[],
  snapshot: FormState,
): ServerFieldErrors | null {
  const fieldErrors = getFieldErrors(error);
  if (!fieldErrors) {
    return null;
  }
  const errors: FormErrors = {};
  const values: Partial<FormState> = {};
  for (const field of fields) {
    const message = fieldErrors[field]?.[0];
    if (message) {
      errors[field] = message;
      Object.assign(values, { [field]: snapshot[field] });
    }
  }
  return Object.keys(errors).length > 0 ? { errors, values } : null;
}

function withoutFields(
  edits: Partial<FormState>,
  fields: readonly DetailsField[],
  onlyIfEqualTo?: FormState,
): Partial<FormState> {
  const next = { ...edits };
  for (const field of fields) {
    if (!(field in next)) {
      continue;
    }
    if (!onlyIfEqualTo || next[field] === onlyIfEqualTo[field]) {
      delete next[field];
    }
  }
  return next;
}

/**
 * The one draft of a restaurant-details page (Profile or Staff communications). Every section
 * edits it; Save writes only the sections with changes, one after another, through the existing
 * restaurant update endpoint and each section's payload.
 */
export function useProfileDraft({
  restaurantId,
  profile,
  updateProfile,
  sections,
  unsavedEntryId,
  leaveMessage,
  onSaveRequested,
}: UseProfileDraftInput) {
  const fieldOrder = useMemo(() => sections.flatMap((section) => section.fields), [sections]);
  const [savedOverride, setSavedOverride] = useState<{
    basedOn: RestaurantProfile;
    state: FormState;
  } | null>(null);
  const [edits, setEdits] = useState<Partial<FormState>>({});
  const [touched, setTouched] = useState<ReadonlySet<DetailsField>>(() => new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [whatsappTurnedOff, setWhatsappTurnedOff] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerFieldErrors>(NO_SERVER_ERRORS);
  const saveSequence = useSettingsSaveSequence();
  const editStartedAtRef = useRef<Partial<Record<ProfileSectionId, number>>>({});

  const initialValues = useMemo<RestaurantDetailsFormValues>(
    () => buildProfileValues(profile),
    [profile],
  );
  // The query cache normally carries each saved response; the override covers the moment
  // between a save resolving and the cache re-rendering this page.
  const savedState = useMemo<FormState>(
    () =>
      savedOverride && savedOverride.basedOn === profile
        ? savedOverride.state
        : mapInitialValues(initialValues),
    [initialValues, profile, savedOverride],
  );
  const draft = useMemo<FormState>(() => ({ ...savedState, ...edits }), [edits, savedState]);

  const dirtyFields = useMemo(
    () => fieldOrder.filter((field) => draft[field] !== savedState[field]),
    [draft, fieldOrder, savedState],
  );
  const dirtySections = useMemo(
    () => sections.filter((section) => section.fields.some((field) => dirtyFields.includes(field))),
    [dirtyFields, sections],
  );
  const isDirty = dirtyFields.length > 0;

  const allErrors = useMemo<FormErrors>(() => {
    const clientErrors = filterErrors(validateRestaurantDetails(draft), fieldOrder);
    const activeServerErrors: FormErrors = {};
    for (const field of fieldOrder) {
      const message = serverErrors.errors[field];
      if (message && draft[field] === serverErrors.values[field]) {
        activeServerErrors[field] = message;
      }
    }
    // Client validation speaks first; a server message stays until its value is edited.
    return { ...activeServerErrors, ...clientErrors };
  }, [draft, fieldOrder, serverErrors]);
  // Only sections being saved can block the save; untouched saved values are left alone.
  const blockingErrors = useMemo<FormErrors>(
    () =>
      filterErrors(
        allErrors,
        dirtySections.flatMap((section) => section.fields),
      ),
    [allErrors, dirtySections],
  );
  const issueCount = Object.keys(blockingErrors).length;
  const visibleErrors = useMemo<FormErrors>(
    () =>
      filterErrors(
        allErrors,
        fieldOrder.filter(
          (field) => touched.has(field) || (showAllErrors && field in blockingErrors),
        ),
      ),
    [allErrors, blockingErrors, fieldOrder, showAllErrors, touched],
  );

  const sectionStatuses = useMemo<ProfileSectionStatus[]>(
    () =>
      sections.map((section) => ({
        section,
        isDirty: dirtySections.includes(section),
        visibleIssueCount: section.fields.filter((field) => visibleErrors[field]).length,
      })),
    [dirtySections, sections, visibleErrors],
  );

  const previewValues = useMemo<RestaurantDetailsFormValues>(
    () => ({ ...initialValues, ...pickDraftValues(draft, fieldOrder) }),
    [draft, fieldOrder, initialValues],
  );

  useRegisterOpsUnsavedChanges(unsavedEntryId, isDirty, leaveMessage);

  useEffect(() => {
    const startedAt = editStartedAtRef.current;
    for (const section of sections) {
      if (dirtySections.includes(section)) {
        startedAt[section.id] ??= Date.now();
      } else {
        delete startedAt[section.id];
      }
    }
  }, [dirtySections, sections]);

  const { clearFailure, run: runSaveSequence, isSaving } = saveSequence;
  const whatsappOnInDraft = draft.managerWhatsappEnabled;

  const setField = useCallback(
    <K extends DetailsField>(field: K, value: FormState[K]) => {
      // A new alert number may not be on WhatsApp yet, so any edit to it turns WhatsApp off.
      const turnsWhatsappOff = field === 'managerNotificationPhone';
      if (turnsWhatsappOff && whatsappOnInDraft) {
        setWhatsappTurnedOff(true);
      }
      setEdits((current) => ({
        ...current,
        [field]: value,
        ...(turnsWhatsappOff ? { managerWhatsappEnabled: false } : {}),
      }));
    },
    [whatsappOnInDraft],
  );

  const markTouched = useCallback((field: DetailsField) => {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }, []);

  const firstIssueField = fieldOrder.find((field) => blockingErrors[field]) ?? null;

  // Save and "Show first issue" both land here while the draft has issues.
  const showFirstIssue = useCallback(() => {
    for (const section of dirtySections) {
      const fields = Object.keys(filterErrors(blockingErrors, section.fields));
      if (fields.length > 0) {
        emitProfileAnalytics('restaurant_profile_validation_error', {
          restaurant_id: restaurantId,
          section: section.analyticsSection,
          field_count: fields.length,
          fields,
        });
      }
    }
    setShowAllErrors(true);
    const elementId = firstIssueField ? PROFILE_FIELD_DOM_IDS[firstIssueField] : null;
    if (elementId) {
      window.requestAnimationFrame(() => focusProfileElement(elementId));
    }
  }, [blockingErrors, dirtySections, firstIssueField, restaurantId]);

  const resetUi = useCallback(() => {
    setTouched(new Set());
    setShowAllErrors(false);
    setWhatsappTurnedOff(false);
    setServerErrors(NO_SERVER_ERRORS);
  }, []);

  const discard = useCallback(() => {
    setEdits({});
    resetUi();
    clearFailure();
    toast('Changes discarded.');
  }, [clearFailure, resetUi]);

  const undoSection = useCallback(
    (sectionId: string) => {
      const section = sections.find((entry) => entry.id === sectionId);
      if (!section) {
        return;
      }
      setEdits((current) => withoutFields(current, section.fields));
      setTouched((current) => {
        const next = new Set(current);
        section.fields.forEach((field) => next.delete(field));
        return next;
      });
      if (section.id === 'notifications') {
        setWhatsappTurnedOff(false);
      }
      clearFailure();
    },
    [clearFailure, sections],
  );

  const save = useCallback(async () => {
    if (dirtySections.length === 0 || isSaving) {
      return;
    }
    onSaveRequested?.(dirtySections.map((section) => section.id));

    if (issueCount > 0) {
      showFirstIssue();
      return;
    }

    const snapshot = draft;
    const savedAtStart = savedState;
    const basedOn = profile;
    const steps: SettingsSaveStep[] = dirtySections.map((section) => ({
      id: section.id,
      name: section.name,
      run: async () => {
        let updated: RestaurantProfile;
        const sectionDirtyFields = new Set(
          section.fields.filter((field) => snapshot[field] !== savedAtStart[field]),
        );
        try {
          updated = await updateProfile(section.buildPayload(snapshot, sectionDirtyFields));
        } catch (error) {
          // 400 VALIDATION_FAILED / 409 SLUG_TAKEN name the fields; show them on the form.
          const fieldErrors = toServerFieldErrors(error, section.fields, snapshot);
          if (fieldErrors) {
            setServerErrors((current) => ({
              errors: { ...current.errors, ...fieldErrors.errors },
              values: { ...current.values, ...fieldErrors.values },
            }));
            setTouched((current) => {
              const next = new Set(current);
              section.fields
                .filter((field) => fieldErrors.errors[field])
                .forEach((field) => next.add(field));
              return next;
            });
          }
          emitProfileAnalytics('restaurant_profile_section_save_failed', {
            restaurant_id: restaurantId,
            section: section.analyticsSection,
            field_count: section.fields.length,
            code: error instanceof Error ? error.name : 'unknown',
          });
          throw error;
        }
        const updatedValues = mapRestaurantProfileValues(updated);
        const startedAt = editStartedAtRef.current[section.id];
        setSavedOverride({ basedOn, state: mapInitialValues(updatedValues) });
        // Keep anything typed while this section was saving.
        setEdits((current) => withoutFields(current, section.fields, snapshot));
        emitProfileAnalytics('restaurant_profile_section_saved', {
          restaurant_id: restaurantId,
          section: section.analyticsSection,
          changed_field_count: section.fields.filter(
            (field) => savedAtStart[field] !== snapshot[field],
          ).length,
          changed_fields: section.fields.filter((field) => savedAtStart[field] !== snapshot[field]),
          elapsed_ms: startedAt === undefined ? null : Math.max(0, Date.now() - startedAt),
          saved_at: updated.updatedAt ?? null,
          ...buildProfileCompletionAnalytics(updatedValues),
        });
      },
    }));

    const outcome = await runSaveSequence(steps);
    if (outcome?.ok) {
      resetUi();
      toast.success(`Saved ${formatSettingsSectionList(outcome.saved)}.`);
    }
  }, [
    dirtySections,
    draft,
    issueCount,
    onSaveRequested,
    profile,
    isSaving,
    resetUi,
    restaurantId,
    runSaveSequence,
    savedState,
    showFirstIssue,
    updateProfile,
  ]);

  const reviewGroups = useMemo<SettingsChangeGroup[]>(
    () =>
      dirtySections.map((section) => ({
        id: section.id,
        title: section.name,
        changes: section.fields
          .filter((field) => dirtyFields.includes(field))
          .map((field) => ({
            label: PROFILE_FIELD_LABELS[field] ?? field,
            was: formatChangeValue(savedState[field]),
            now: formatChangeValue(draft[field]),
          })),
      })),
    [dirtyFields, dirtySections, draft, savedState],
  );

  return {
    draft,
    savedState,
    initialValues,
    previewValues,
    dirtyFields,
    dirtySections,
    isDirty,
    issueCount,
    visibleErrors,
    sectionStatuses,
    whatsappTurnedOff,
    setField,
    markTouched,
    showFirstIssue,
    discard,
    undoSection,
    save,
    reviewOpen,
    setReviewOpen,
    reviewGroups,
    progress: saveSequence.progress,
    failure: saveSequence.failure,
    isSaving,
  };
}
