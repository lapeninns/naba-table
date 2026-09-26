'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import { toast } from 'sonner';

import {
  draftsReducer,
  isDraftDirty,
} from '@/components/features/email-templates/model/emailTemplateDrafts';
import {
  buildNewVariant,
  createVariantId,
  describeSaveBlocker,
  duplicateVariant,
  saveBlockers,
  type SaveBlocker,
  type VariantField,
} from '@/components/features/email-templates/model/emailTemplateEditorModel';
import { getSafeSettingsErrorMessage } from '@/components/features/restaurant-settings/shared/settingsErrorCopy';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useRegisterOptionalOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import {
  useOpsEmailTemplatePreview,
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
} from '@/hooks/ops/useOpsRestaurantEmailTemplates';
import {
  MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS,
  type RestaurantBookingEmailTemplateKey,
  type RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';

import type { RestaurantEmailTemplate } from '@/services/ops/restaurants';

/** Unsaved-changes registry id; the settings sidebar marks Email templates "Unsaved" from it. */
export const EMAIL_TEMPLATES_UNSAVED_ENTRY_ID = 'restaurant-email-templates';

export type EmailTemplateListItem = {
  key: RestaurantBookingEmailTemplateKey;
  title: string;
  description: string;
  isCustom: boolean;
  liveCount: number;
  isDirty: boolean;
};

export type EmailTemplateListGroup = {
  key: string;
  title: string;
  templates: EmailTemplateListItem[];
};

export type SaveOutcome =
  | { status: 'saved' }
  | { status: 'blocked'; blocker: SaveBlocker }
  | { status: 'failed' }
  | { status: 'idle' };

type Selection = Partial<Record<RestaurantBookingEmailTemplateKey, string>>;

/**
 * State and actions for the email templates workspace. Drafts live in a reducer
 * (`model/emailTemplateDrafts`) until saved one template at a time; the server data hooks own
 * everything persisted.
 */
export function useOpsEmailTemplatesEditor() {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantId =
    activeMembership?.restaurantId ?? activeRestaurantId ?? memberships[0]?.restaurantId ?? null;
  const restaurantName =
    activeMembership?.restaurantName ?? memberships[0]?.restaurantName ?? 'your venue';

  const templatesQuery = useOpsRestaurantEmailTemplates(restaurantId);
  const updateMutation = useOpsUpdateRestaurantEmailTemplate(restaurantId);
  const resetMutation = useOpsResetRestaurantEmailTemplate(restaurantId);
  const testSendMutation = useOpsSendRestaurantEmailTemplateTest(restaurantId);

  const [drafts, dispatch] = useReducer(draftsReducer, {});
  const [requestedKey, setRequestedKey] = useState<RestaurantBookingEmailTemplateKey | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Selection>({});
  const [previewVariantId, setPreviewVariantId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [problemsShownFor, setProblemsShownFor] = useState<Set<RestaurantBookingEmailTemplateKey>>(
    () => new Set(),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadedRestaurantId, setLoadedRestaurantId] = useState(restaurantId);

  useEffect(() => {
    if (!activeRestaurantId && memberships[0]) setActiveRestaurantId(memberships[0].restaurantId);
  }, [activeRestaurantId, memberships, setActiveRestaurantId]);

  // Another restaurant's drafts and selection never carry over.
  if (loadedRestaurantId !== restaurantId) {
    setLoadedRestaurantId(restaurantId);
    dispatch({ type: 'clear' });
    setRequestedKey(null);
    setSelectedVariants({});
    setPreviewVariantId(null);
    setProblemsShownFor(new Set());
    setSaveError(null);
  }

  const snapshot = templatesQuery.data;
  const canEdit = Boolean(snapshot?.canEdit);
  const templates = useMemo(
    () => snapshot?.groups.flatMap((group) => group.templates) ?? [],
    [snapshot],
  );
  const template: RestaurantEmailTemplate | null =
    templates.find((candidate) => candidate.key === requestedKey) ?? templates[0] ?? null;
  const templateKey = template?.key ?? null;

  const variantsFor = useCallback(
    (candidate: RestaurantEmailTemplate) => drafts[candidate.key] ?? candidate.variants,
    [drafts],
  );
  const variants = useMemo(() => (template ? variantsFor(template) : []), [template, variantsFor]);
  const variant =
    variants.find((candidate) => candidate.id === (templateKey && selectedVariants[templateKey])) ??
    variants[0] ??
    null;

  const dirtyKeys = useMemo(
    () =>
      new Set(
        templates
          .filter((candidate) => isDraftDirty(drafts[candidate.key], candidate.variants))
          .map((candidate) => candidate.key),
      ),
    [drafts, templates],
  );
  const isDirty = Boolean(templateKey && dirtyKeys.has(templateKey));
  const otherDirtyTitles = templates
    .filter((candidate) => candidate.key !== templateKey && dirtyKeys.has(candidate.key))
    .map((candidate) => candidate.title);

  useRegisterOptionalOpsUnsavedChanges(
    EMAIL_TEMPLATES_UNSAVED_ENTRY_ID,
    dirtyKeys.size > 0,
    `You have unsaved changes to ${dirtyKeys.size === 1 ? '1 email' : `${dirtyKeys.size} emails`}. Leave without saving?`,
  );

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const groups = useMemo<EmailTemplateListGroup[]>(
    () =>
      (snapshot?.groups ?? [])
        .map((group) => ({
          key: group.key,
          title: group.title,
          templates: group.templates
            .filter(
              (candidate) =>
                !deferredSearch ||
                `${candidate.title} ${candidate.description} ${candidate.key}`
                  .toLowerCase()
                  .includes(deferredSearch),
            )
            .map((candidate) => ({
              key: candidate.key,
              title: candidate.title,
              description: candidate.description,
              isCustom: candidate.status === 'custom',
              liveCount: variantsFor(candidate).filter((item) => item.isActive).length,
              isDirty: dirtyKeys.has(candidate.key),
            })),
        }))
        .filter((group) => group.templates.length > 0),
    [deferredSearch, dirtyKeys, snapshot, variantsFor],
  );

  const blockers = useMemo(
    () => (templateKey ? saveBlockers(variants, templateKey) : []),
    [templateKey, variants],
  );
  const showAllProblems = Boolean(templateKey && problemsShownFor.has(templateKey));

  const previewVariant =
    variants.find((candidate) => candidate.id === previewVariantId) ?? variant ?? null;
  const previewQuery = useOpsEmailTemplatePreview({
    restaurantId,
    templateKey,
    variantId: previewVariant?.id ?? null,
    variants,
  });

  /* ───────── selection ───────── */

  const selectTemplate = (key: RestaurantBookingEmailTemplateKey) => {
    setRequestedKey(key);
    setPreviewVariantId(null);
    setSaveError(null);
  };

  const selectVariant = (variantId: string) => {
    if (!templateKey) return;
    setSelectedVariants((current) => ({ ...current, [templateKey]: variantId }));
    setPreviewVariantId(null);
  };

  /* ───────── editing ───────── */

  const base = template?.variants ?? [];

  const editField = (field: VariantField, value: string) => {
    if (!templateKey || !variant || !canEdit) return;
    setSaveError(null);
    dispatch({ type: 'edit', key: templateKey, base, variantId: variant.id, field, value });
  };

  const setLive = (isActive: boolean) => {
    if (!templateKey || !variant || !canEdit) return;
    dispatch({ type: 'set-live', key: templateKey, base, variantId: variant.id, isActive });
  };

  const insertVariant = (next: RestaurantEmailTemplateVariant) => {
    if (!templateKey) return;
    dispatch({ type: 'add', key: templateKey, base, variant: next });
    setSelectedVariants((current) => ({ ...current, [templateKey]: next.id }));
    setPreviewVariantId(null);
  };

  const canAddVariant = canEdit && variants.length < MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS;

  const addVariant = () => {
    if (!templateKey || !canAddVariant) return;
    insertVariant(buildNewVariant(templateKey, variants, createVariantId(templateKey)));
  };

  const duplicateCurrentVariant = () => {
    if (!templateKey || !variant || !canAddVariant) return;
    insertVariant(duplicateVariant(variant, variants.length, createVariantId(templateKey)));
  };

  const moveVariant = (direction: -1 | 1) => {
    if (!templateKey || !variant || !canEdit) return;
    dispatch({ type: 'move', key: templateKey, base, variantId: variant.id, direction });
  };

  const deleteVariant = () => {
    if (!templateKey || !variant || !canEdit || variants.length <= 1) return;
    const index = variants.indexOf(variant);
    const neighbour = variants[index + 1] ?? variants[index - 1];
    dispatch({ type: 'delete', key: templateKey, base, variantId: variant.id });
    if (neighbour) setSelectedVariants((current) => ({ ...current, [templateKey]: neighbour.id }));
    setPreviewVariantId(null);
  };

  /* ───────── commit ───────── */

  const discard = () => {
    if (!templateKey || !template) return;
    dispatch({ type: 'discard', key: templateKey });
    setSaveError(null);
    setProblemsShownFor((current) => {
      const next = new Set(current);
      next.delete(templateKey);
      return next;
    });
    toast.message('Changes discarded', {
      description: `${template.title} is back to the saved copy.`,
    });
  };

  const save = async (): Promise<SaveOutcome> => {
    if (!templateKey || !template || !canEdit || !isDirty || updateMutation.isPending) {
      return { status: 'idle' };
    }
    const first = blockers[0];
    if (first) {
      setProblemsShownFor((current) => new Set(current).add(templateKey));
      if (first.kind !== 'no-live') {
        setSelectedVariants((current) => ({ ...current, [templateKey]: first.variantId }));
      }
      return { status: 'blocked', blocker: first };
    }

    const sent = variants.map((item, order) => ({ ...item, order }));
    setSaveError(null);
    try {
      const saved = await updateMutation.mutateAsync({ templateKey, variants: sent });
      // Anything typed while the request was in flight stays as the newer draft.
      dispatch({ type: 'saved', key: templateKey, sent: variants, saved: saved.variants });
      setProblemsShownFor((current) => {
        const next = new Set(current);
        next.delete(templateKey);
        return next;
      });
      toast.success(`${template.title} saved`, {
        description: 'Emails sent from now on use this copy.',
      });
      return { status: 'saved' };
    } catch (error) {
      setSaveError(getSafeSettingsErrorMessage(error, 'The copy could not be saved.'));
      return { status: 'failed' };
    }
  };

  const reset = async (): Promise<boolean> => {
    if (!templateKey || !template || !canEdit || template.status !== 'custom') return false;
    try {
      await resetMutation.mutateAsync({ templateKey });
      dispatch({ type: 'discard', key: templateKey });
      setSelectedVariants((current) => {
        const next = { ...current };
        delete next[templateKey];
        return next;
      });
      setPreviewVariantId(null);
      setSaveError(null);
      toast.success(`${template.title} reset`, {
        description: 'Emails sent from now on use the Nabatable default copy.',
      });
      return true;
    } catch (error) {
      toast.error('Not reset', {
        description: getSafeSettingsErrorMessage(error, 'The email could not be reset.'),
      });
      return false;
    }
  };

  const sendTest = async (toEmail: string): Promise<boolean> => {
    if (!templateKey || !variant || !canEdit) return false;
    try {
      await testSendMutation.mutateAsync({
        templateKey,
        payload: {
          toEmail: toEmail.trim(),
          preferredVariantId: variant.id,
          // Only the open variant: the API validates every variant sent, so an unfinished
          // sibling would otherwise reject a test the dialog allows.
          variants: [{ ...variant, order: 0 }],
        },
      });
      toast.success('Test handed to the email provider', {
        description: `It is on its way to ${toEmail.trim()}. It usually arrives within a minute; check spam if it does not.`,
      });
      return true;
    } catch (error) {
      toast.error('Test not sent', {
        description: getSafeSettingsErrorMessage(error, 'The test email could not be sent.'),
      });
      return false;
    }
  };

  return {
    memberships,
    restaurantId,
    restaurantName,
    templatesQuery,
    canEdit,
    // list
    search,
    setSearch,
    groups,
    templateCount: templates.length,
    customisedCount: templates.filter((candidate) => candidate.status === 'custom').length,
    // selection
    template,
    templateKey,
    variants,
    variant,
    selectTemplate,
    selectVariant,
    // editing
    editField,
    setLive,
    canAddVariant,
    addVariant,
    duplicateVariant: duplicateCurrentVariant,
    moveVariant,
    deleteVariant,
    // status
    isDirty,
    otherDirtyTitles,
    blockers,
    showAllProblems,
    describeBlocker: (blocker: SaveBlocker) => describeSaveBlocker(blocker, variants),
    // commit
    save,
    isSaving: updateMutation.isPending,
    saveError,
    discard,
    reset,
    isResetting: resetMutation.isPending,
    // preview and test
    previewVariant,
    setPreviewVariantId,
    previewQuery,
    sendTest,
    isSendingTest: testSendMutation.isPending,
  };
}

export type OpsEmailTemplatesEditor = ReturnType<typeof useOpsEmailTemplatesEditor>;
