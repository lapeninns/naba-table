'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getSafeSettingsErrorMessage } from '@/components/features/restaurant-settings/shared/settingsErrorCopy';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import {
  useOpsResetRestaurantEmailTemplate,
  useOpsRestaurantEmailTemplatePreview,
  useOpsRestaurantEmailTemplates,
  useOpsSendRestaurantEmailTemplateTest,
  useOpsUpdateRestaurantEmailTemplate,
  type EmailTemplatePreviewRequest,
} from '@/hooks/ops/useOpsRestaurantEmailTemplates';
import { toUserMessage } from '@/lib/http/userMessage';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import { hashEmailTemplatePreviewInput } from '@/services/ops/email-templates';
import { useEmailTemplateDraftState } from '@src/hooks/ops/useEmailTemplateDraftState';

import type { RestaurantBookingEmailTemplateKey } from '@/lib/restaurants/email-templates';

export type {
  EmailTemplatesActivePane,
  EmailTemplatesPreviewDevice,
} from '@src/hooks/ops/useEmailTemplateDraftState';

const PREVIEW_ERROR_COPY = {
  RATE_LIMITED:
    'The preview is paused after too many updates. Wait a moment, then retry the preview.',
  VALIDATION_FAILED: 'The preview needs a valid draft. Check the highlighted fields.',
};

/**
 * Email templates workspace: resolves the restaurant, composes the draft UI state
 * (useEmailTemplateDraftState) with the template queries and mutations, and owns the save,
 * reset (confirmed through a dialog) and test-send flows.
 */
export function useOpsEmailTemplatesPageState() {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantId =
    activeMembership?.restaurantId ?? activeRestaurantId ?? memberships[0]?.restaurantId ?? null;
  const restaurantName =
    activeMembership?.restaurantName ?? memberships[0]?.restaurantName ?? 'Selected restaurant';

  const templatesQuery = useOpsRestaurantEmailTemplates(restaurantId);
  const updateMutation = useOpsUpdateRestaurantEmailTemplate(restaurantId);
  const resetMutation = useOpsResetRestaurantEmailTemplate(restaurantId);
  const testSendMutation = useOpsSendRestaurantEmailTemplateTest(restaurantId);

  const draftState = useEmailTemplateDraftState(restaurantId, templatesQuery.data);
  const {
    templateMap,
    selectedTemplateKey,
    selectedVariantId,
    currentVariants,
    testEmail,
    clearDraft,
    rebaseDraftOnSaved,
  } = draftState;

  const [pendingResetTemplateKey, setPendingResetTemplateKey] =
    useState<RestaurantBookingEmailTemplateKey | null>(null);
  const testSendIntentRef = useRef<{ intent: string; key: string } | null>(null);

  useEffect(() => {
    if (activeRestaurantId || !memberships[0]) {
      return;
    }

    setActiveRestaurantId(memberships[0].restaurantId);
  }, [activeRestaurantId, memberships, setActiveRestaurantId]);

  const previewRequest = useMemo<EmailTemplatePreviewRequest | null>(() => {
    if (!restaurantId || !selectedTemplateKey || !currentVariants.length) {
      return null;
    }
    return {
      templateKey: selectedTemplateKey,
      payload: {
        preferredVariantId: selectedVariantId ?? undefined,
        variants: currentVariants,
      },
    };
  }, [currentVariants, restaurantId, selectedTemplateKey, selectedVariantId]);

  const previewQuery = useOpsRestaurantEmailTemplatePreview(restaurantId, previewRequest);
  const preview = previewQuery.data?.templateKey === selectedTemplateKey ? previewQuery.data : null;
  const previewErrorMessage = previewQuery.error
    ? toUserMessage(previewQuery.error, {
        copy: PREVIEW_ERROR_COPY,
        fallback: "The preview couldn't be rendered. Keep editing or retry the preview.",
      })
    : null;
  const retryPreview = () => {
    void previewQuery.refetch();
  };
  const isPreviewLoading = previewQuery.isPreviewStale && !preview;

  const handleSave = async () => {
    if (!selectedTemplateKey) return;

    const sent = currentVariants;
    try {
      const saved = await updateMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        variants: sent,
      });

      rebaseDraftOnSaved(selectedTemplateKey, sent, saved.variants);

      toast.success('Template saved', {
        description: 'Restaurant-specific copy variants are now live for future sends.',
      });
    } catch (error) {
      toast.error('Save failed', {
        description: getSafeSettingsErrorMessage(error, 'The template could not be saved.'),
      });
    }
  };

  /** Opens the reset confirmation for a customised template; default templates are ignored. */
  const handleResetTemplate = (templateKey: RestaurantBookingEmailTemplateKey) => {
    const template = templateMap.get(templateKey);
    if (!template || template.status === 'default') {
      return;
    }
    setPendingResetTemplateKey(templateKey);
  };

  const cancelResetTemplate = () => setPendingResetTemplateKey(null);

  const confirmResetTemplate = async () => {
    const templateKey = pendingResetTemplateKey;
    const template = templateKey ? templateMap.get(templateKey) : undefined;
    if (!templateKey || !template) {
      setPendingResetTemplateKey(null);
      return;
    }

    try {
      await resetMutation.mutateAsync({ templateKey });
      clearDraft(templateKey);
      setPendingResetTemplateKey(null);

      toast.success('Template reset', {
        description: `${template.title} is using the default copy again.`,
      });
    } catch (error) {
      toast.error('Reset failed', {
        description: getSafeSettingsErrorMessage(error, 'The template could not be reset.'),
      });
    }
  };

  const pendingResetTemplate = pendingResetTemplateKey
    ? (templateMap.get(pendingResetTemplateKey) ?? null)
    : null;

  const handleSendTest = async () => {
    if (!selectedTemplateKey) return;
    const toEmail = testEmail.trim();
    if (!toEmail) {
      toast.error('Enter a test email address first.');
      return;
    }

    const payload = {
      toEmail,
      preferredVariantId: selectedVariantId ?? undefined,
      variants: currentVariants,
    };
    // One idempotency key per send intent (template, address and draft): clicking again after a
    // failure retries the same intent, so the provider never sends it twice; a new draft, address
    // or a completed send starts a new intent.
    const intent = `${selectedTemplateKey}|${toEmail.toLowerCase()}|${hashEmailTemplatePreviewInput(payload)}`;
    if (testSendIntentRef.current?.intent !== intent) {
      testSendIntentRef.current = { intent, key: generateIdempotencyKey() };
    }
    const idempotencyKey = testSendIntentRef.current.key;

    try {
      await testSendMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        payload,
        idempotencyKey,
      });
      testSendIntentRef.current = null;
    } catch {
      // Feedback is the hook's (meta.feedback); the key is kept so a retry is deduplicated.
    }
  };

  return {
    memberships,
    restaurantId,
    restaurantName,
    activeMembership,
    setActiveRestaurantId,
    templatesQuery,
    updateMutation,
    resetMutation,
    previewQuery,
    testSendMutation,
    selectedTemplateKey,
    selectedVariantId,
    currentVariants,
    currentVariant: draftState.currentVariant,
    baseTemplate: draftState.baseTemplate,
    filteredGroups: draftState.filteredGroups,
    searchQuery: draftState.searchQuery,
    setSearchQuery: draftState.setSearchQuery,
    previewDevice: draftState.previewDevice,
    setPreviewDevice: draftState.setPreviewDevice,
    testEmail,
    setTestEmail: draftState.setTestEmail,
    activePane: draftState.activePane,
    setActivePane: draftState.setActivePane,
    dirtyTemplateKeys: draftState.dirtyTemplateKeys,
    hasDirtyDrafts: draftState.hasDirtyDrafts,
    isCurrentDirty: draftState.isCurrentDirty,
    preview,
    isPreviewLoading,
    previewErrorMessage,
    retryPreview,
    activeVariantCount: draftState.activeVariantCount,
    handleSelectTemplate: draftState.handleSelectTemplate,
    handleAddVariant: draftState.handleAddVariant,
    handleMoveVariant: draftState.handleMoveVariant,
    handleDeleteVariant: draftState.handleDeleteVariant,
    handleDiscardCurrent: draftState.handleDiscardCurrent,
    handleSave,
    handleResetTemplate,
    pendingResetTemplate,
    confirmResetTemplate,
    cancelResetTemplate,
    handleSendTest,
    updateCurrentVariant: draftState.updateCurrentVariant,
    setSelectedVariantId: draftState.setSelectedVariantId,
  };
}
