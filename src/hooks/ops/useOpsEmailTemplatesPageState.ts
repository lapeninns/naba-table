'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import {
  useOpsPreviewRestaurantEmailTemplate,
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

import type { RestaurantEmailTemplatesSnapshot } from '@/services/ops/restaurants';

export type EmailTemplatesActivePane = 'list' | 'editor' | 'preview';
export type EmailTemplatesPreviewDevice = 'desktop' | 'mobile';

function createVariantId(templateKey: RestaurantBookingEmailTemplateKey) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${templateKey}-${crypto.randomUUID()}`;
  }

  return `${templateKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVariantsForCompare(variants: RestaurantEmailTemplateVariant[]) {
  return JSON.stringify(
    [...variants]
      .sort((left, right) => left.order - right.order)
      .map((variant) => ({
        id: variant.id,
        name: variant.name,
        subject: variant.subject,
        preheader: variant.preheader,
        headline: variant.headline,
        intro: variant.intro,
        cue: variant.cue,
        ask: variant.ask,
        ctaLabel: variant.ctaLabel,
        isActive: variant.isActive,
        order: variant.order,
      })),
  );
}

/**
 * The draft to keep once a save returns: null when nothing changed after the request was sent.
 * Otherwise the server's variants with every field edited since the send kept as the newer value;
 * variants added after the send are kept as typed, and removed ones stay removed.
 */
function rebaseVariantsOnSaved(
  current: RestaurantEmailTemplateVariant[] | undefined,
  sent: RestaurantEmailTemplateVariant[],
  saved: RestaurantEmailTemplateVariant[],
): RestaurantEmailTemplateVariant[] | null {
  if (!current || current === sent) {
    return null;
  }
  const sentById = new Map(sent.map((variant) => [variant.id, variant]));
  const savedById = new Map(saved.map((variant) => [variant.id, variant]));
  const rebased = current.map((variant) => {
    const sentVariant = sentById.get(variant.id);
    const savedVariant = savedById.get(variant.id);
    if (!sentVariant || !savedVariant) {
      return variant;
    }
    const next = { ...savedVariant };
    for (const field of Object.keys(next) as Array<keyof RestaurantEmailTemplateVariant>) {
      if (variant[field] !== sentVariant[field]) {
        Object.assign(next, { [field]: variant[field] });
      }
    }
    return next;
  });
  return normalizeVariantsForCompare(rebased) === normalizeVariantsForCompare(saved)
    ? null
    : rebased;
}

function buildTemplateMap(snapshot: RestaurantEmailTemplatesSnapshot | undefined) {
  return new Map(
    snapshot?.groups.flatMap((group) => group.templates).map((template) => [template.key, template]) ?? [],
  );
}

export function useOpsEmailTemplatesPageState() {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantId = activeMembership?.restaurantId ?? activeRestaurantId ?? memberships[0]?.restaurantId ?? null;
  const restaurantName = activeMembership?.restaurantName ?? memberships[0]?.restaurantName ?? 'Selected restaurant';

  const templatesQuery = useOpsRestaurantEmailTemplates(restaurantId);
  const updateMutation = useOpsUpdateRestaurantEmailTemplate(restaurantId);
  const resetMutation = useOpsResetRestaurantEmailTemplate(restaurantId);
  const previewMutation = useOpsPreviewRestaurantEmailTemplate(restaurantId);
  const testSendMutation = useOpsSendRestaurantEmailTemplateTest(restaurantId);
  const previewDraft = previewMutation.mutate;

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<RestaurantBookingEmailTemplateKey | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Partial<Record<RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateVariant[]>>
  >({});
  const [searchQuery, setSearchQuery] = useState('');
  const [previewDevice, setPreviewDevice] = useState<EmailTemplatesPreviewDevice>('desktop');
  const [testEmail, setTestEmail] = useState('');
  const [activePane, setActivePane] = useState<EmailTemplatesActivePane>('list');

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const previousRestaurantIdRef = useRef<string | null>(restaurantId);

  useEffect(() => {
    if (activeRestaurantId || !memberships[0]) {
      return;
    }

    setActiveRestaurantId(memberships[0].restaurantId);
  }, [activeRestaurantId, memberships, setActiveRestaurantId]);

  useEffect(() => {
    if (previousRestaurantIdRef.current === restaurantId) {
      return;
    }

    previousRestaurantIdRef.current = restaurantId;
    setSelectedTemplateKey(null);
    setSelectedVariantId(null);
    setDrafts({});
    setTestEmail('');
    setActivePane('list');
  }, [restaurantId]);

  const templateMap = useMemo(() => buildTemplateMap(templatesQuery.data), [templatesQuery.data]);
  const allTemplates = useMemo(
    () => templatesQuery.data?.groups.flatMap((group) => group.templates) ?? [],
    [templatesQuery.data],
  );

  useEffect(() => {
    if (selectedTemplateKey && templateMap.has(selectedTemplateKey)) {
      return;
    }

    const firstTemplate = allTemplates[0];
    if (firstTemplate) {
      setSelectedTemplateKey(firstTemplate.key);
      return;
    }

    setSelectedTemplateKey(null);
  }, [allTemplates, selectedTemplateKey, templateMap]);

  const filteredGroups = useMemo(() => {
    if (!templatesQuery.data) return [];
    if (!deferredSearch) return templatesQuery.data.groups;

    return templatesQuery.data.groups
      .map((group) => ({
        ...group,
        templates: group.templates.filter((template) => {
          const haystack = `${group.title} ${template.title} ${template.description}`.toLowerCase();
          return haystack.includes(deferredSearch);
        }),
      }))
      .filter((group) => group.templates.length > 0);
  }, [deferredSearch, templatesQuery.data]);

  const baseTemplate = selectedTemplateKey ? templateMap.get(selectedTemplateKey) ?? null : null;
  const currentVariants = useMemo(() => {
    if (!selectedTemplateKey || !baseTemplate) return [];
    return drafts[selectedTemplateKey] ?? baseTemplate.variants;
  }, [baseTemplate, drafts, selectedTemplateKey]);

  const currentVariant = useMemo(
    () => currentVariants.find((variant) => variant.id === selectedVariantId) ?? currentVariants[0] ?? null,
    [currentVariants, selectedVariantId],
  );

  useEffect(() => {
    if (!currentVariants.length) {
      setSelectedVariantId(null);
      return;
    }

    if (selectedVariantId && currentVariants.some((variant) => variant.id === selectedVariantId)) {
      return;
    }

    setSelectedVariantId(currentVariants[0]!.id);
  }, [currentVariants, selectedVariantId]);

  const dirtyTemplateKeys = useMemo(() => {
    const next = new Set<RestaurantBookingEmailTemplateKey>();

    Object.entries(drafts).forEach(([key, variants]) => {
      if (!variants) return;
      const template = templateMap.get(key as RestaurantBookingEmailTemplateKey);
      if (!template) return;

      if (normalizeVariantsForCompare(variants) !== normalizeVariantsForCompare(template.variants)) {
        next.add(key as RestaurantBookingEmailTemplateKey);
      }
    });

    return next;
  }, [drafts, templateMap]);

  const hasDirtyDrafts = dirtyTemplateKeys.size > 0;
  const isCurrentDirty = Boolean(selectedTemplateKey && dirtyTemplateKeys.has(selectedTemplateKey));

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasDirtyDrafts) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirtyDrafts]);

  useEffect(() => {
    if (!restaurantId || !selectedTemplateKey || !currentVariants.length) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      previewDraft({
        templateKey: selectedTemplateKey,
        payload: {
          preferredVariantId: selectedVariantId ?? undefined,
          variants: currentVariants,
        },
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [currentVariants, previewDraft, restaurantId, selectedTemplateKey, selectedVariantId]);

  const preview = previewMutation.data?.templateKey === selectedTemplateKey ? previewMutation.data : null;
  const activeVariantCount = currentVariants.filter((variant) => variant.isActive).length;

  const updateCurrentVariants = (
    updater: (variants: RestaurantEmailTemplateVariant[]) => RestaurantEmailTemplateVariant[],
  ) => {
    if (!selectedTemplateKey) return;

    setDrafts((current) => {
      const template = templateMap.get(selectedTemplateKey);
      const baseline = current[selectedTemplateKey] ?? template?.variants ?? [];
      return {
        ...current,
        [selectedTemplateKey]: updater(baseline),
      };
    });
  };

  const updateCurrentVariant = (
    variantId: string,
    updater: (variant: RestaurantEmailTemplateVariant) => RestaurantEmailTemplateVariant,
  ) => {
    updateCurrentVariants((variants) =>
      variants.map((variant) => (variant.id === variantId ? updater(variant) : variant)),
    );
  };

  const handleSelectTemplate = (templateKey: RestaurantBookingEmailTemplateKey) => {
    setSelectedTemplateKey(templateKey);
    setActivePane('editor');
  };

  const handleAddVariant = () => {
    if (!selectedTemplateKey || !baseTemplate || currentVariants.length >= MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS) {
      return;
    }

    const seed = currentVariant ?? currentVariants[currentVariants.length - 1] ?? baseTemplate.defaultVariants[0];
    const nextVariant: RestaurantEmailTemplateVariant = {
      ...seed,
      id: createVariantId(selectedTemplateKey),
      name: `Variant ${String.fromCharCode(65 + currentVariants.length)}`,
      order: currentVariants.length,
      isActive: true,
    };

    updateCurrentVariants((variants) => [...variants, nextVariant]);
    setSelectedVariantId(nextVariant.id);
  };

  const handleMoveVariant = (variantId: string, direction: -1 | 1) => {
    updateCurrentVariants((variants) => {
      const ordered = [...variants].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((variant) => variant.id === variantId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return variants;
      }

      const swapped = [...ordered];
      [swapped[index], swapped[targetIndex]] = [swapped[targetIndex]!, swapped[index]!];
      return swapped.map((variant, nextIndex) => ({ ...variant, order: nextIndex }));
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    if (currentVariants.length <= 1) {
      toast.error('Each template needs at least one variant.');
      return;
    }

    updateCurrentVariants((variants) =>
      variants
        .filter((variant) => variant.id !== variantId)
        .map((variant, index) => ({ ...variant, order: index })),
    );

    if (selectedVariantId === variantId) {
      const nextVariant = currentVariants.find((variant) => variant.id !== variantId);
      setSelectedVariantId(nextVariant?.id ?? null);
    }
  };

  const handleDiscardCurrent = () => {
    if (!selectedTemplateKey) return;

    setDrafts((current) => {
      const next = { ...current };
      delete next[selectedTemplateKey];
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedTemplateKey) return;

    const sent = currentVariants;
    try {
      const saved = await updateMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        variants: sent,
      });

      // Anything typed while the request was in flight stays as the newer draft.
      setDrafts((current) => {
        const next = { ...current };
        const rebased = rebaseVariantsOnSaved(current[selectedTemplateKey], sent, saved.variants);
        if (rebased) {
          next[selectedTemplateKey] = rebased;
        } else {
          delete next[selectedTemplateKey];
        }
        return next;
      });

      toast.success('Template saved', {
        description: 'Restaurant-specific copy variants are now live for future sends.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save template';
      toast.error('Save failed', { description: message });
    }
  };

  const handleResetTemplate = async (templateKey: RestaurantBookingEmailTemplateKey) => {
    const template = templateMap.get(templateKey);
    if (!template || template.status === 'default') {
      return;
    }

    const confirmed = window.confirm(`Reset "${template.title}" back to the system default variants?`);
    if (!confirmed) return;

    try {
      await resetMutation.mutateAsync({ templateKey });

      setDrafts((current) => {
        const next = { ...current };
        delete next[templateKey];
        return next;
      });

      toast.success('Template reset', {
        description: `${template.title} is using the default copy again.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reset template';
      toast.error('Reset failed', { description: message });
    }
  };

  const handleSendTest = async () => {
    if (!selectedTemplateKey) return;
    if (!testEmail.trim()) {
      toast.error('Enter a test email address first.');
      return;
    }

    try {
      const result = await testSendMutation.mutateAsync({
        templateKey: selectedTemplateKey,
        payload: {
          toEmail: testEmail.trim(),
          preferredVariantId: selectedVariantId ?? undefined,
          variants: currentVariants,
        },
      });

      toast.success('Test email sent', {
        description: `Delivered to ${testEmail.trim()} via ${result.provider}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send test email';
      toast.error('Test send failed', { description: message });
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
    previewMutation,
    testSendMutation,
    selectedTemplateKey,
    selectedVariantId,
    currentVariants,
    currentVariant,
    baseTemplate,
    filteredGroups,
    searchQuery,
    setSearchQuery,
    previewDevice,
    setPreviewDevice,
    testEmail,
    setTestEmail,
    activePane,
    setActivePane,
    dirtyTemplateKeys,
    hasDirtyDrafts,
    isCurrentDirty,
    preview,
    activeVariantCount,
    handleSelectTemplate,
    handleAddVariant,
    handleMoveVariant,
    handleDeleteVariant,
    handleDiscardCurrent,
    handleSave,
    handleResetTemplate,
    handleSendTest,
    updateCurrentVariant,
    setSelectedVariantId,
  };
}
