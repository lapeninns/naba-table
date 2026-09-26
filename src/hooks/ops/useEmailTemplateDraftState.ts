'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
export function rebaseVariantsOnSaved(
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
    snapshot?.groups
      .flatMap((group) => group.templates)
      .map((template) => [template.key, template]) ?? [],
  );
}

/**
 * UI state of the email templates workspace: which template and variant are selected, the local
 * drafts and their dirtiness, search, panes and variant editing. No server calls; the page hook
 * composes it with the queries and mutations.
 */
export function useEmailTemplateDraftState(
  restaurantId: string | null,
  snapshot: RestaurantEmailTemplatesSnapshot | undefined,
) {
  const [selectedTemplateKey, setSelectedTemplateKey] =
    useState<RestaurantBookingEmailTemplateKey | null>(null);
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

  const templateMap = useMemo(() => buildTemplateMap(snapshot), [snapshot]);
  const allTemplates = useMemo(
    () => snapshot?.groups.flatMap((group) => group.templates) ?? [],
    [snapshot],
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
    if (!snapshot) return [];
    if (!deferredSearch) return snapshot.groups;

    return snapshot.groups
      .map((group) => ({
        ...group,
        templates: group.templates.filter((template) => {
          const haystack = `${group.title} ${template.title} ${template.description}`.toLowerCase();
          return haystack.includes(deferredSearch);
        }),
      }))
      .filter((group) => group.templates.length > 0);
  }, [deferredSearch, snapshot]);

  const baseTemplate = selectedTemplateKey ? (templateMap.get(selectedTemplateKey) ?? null) : null;
  const currentVariants = useMemo(() => {
    if (!selectedTemplateKey || !baseTemplate) return [];
    return drafts[selectedTemplateKey] ?? baseTemplate.variants;
  }, [baseTemplate, drafts, selectedTemplateKey]);

  const currentVariant = useMemo(
    () =>
      currentVariants.find((variant) => variant.id === selectedVariantId) ??
      currentVariants[0] ??
      null,
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

      if (
        normalizeVariantsForCompare(variants) !== normalizeVariantsForCompare(template.variants)
      ) {
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
    if (
      !selectedTemplateKey ||
      !baseTemplate ||
      currentVariants.length >= MAX_RESTAURANT_EMAIL_TEMPLATE_VARIANTS
    ) {
      return;
    }

    const seed =
      currentVariant ??
      currentVariants[currentVariants.length - 1] ??
      baseTemplate.defaultVariants[0];
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

  const clearDraft = (templateKey: RestaurantBookingEmailTemplateKey) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[templateKey];
      return next;
    });
  };

  const handleDiscardCurrent = () => {
    if (!selectedTemplateKey) return;
    clearDraft(selectedTemplateKey);
  };

  /** After a save: anything typed while the request was in flight stays as the newer draft. */
  const rebaseDraftOnSaved = (
    templateKey: RestaurantBookingEmailTemplateKey,
    sent: RestaurantEmailTemplateVariant[],
    saved: RestaurantEmailTemplateVariant[],
  ) => {
    setDrafts((current) => {
      const next = { ...current };
      const rebased = rebaseVariantsOnSaved(current[templateKey], sent, saved);
      if (rebased) {
        next[templateKey] = rebased;
      } else {
        delete next[templateKey];
      }
      return next;
    });
  };

  return {
    templateMap,
    selectedTemplateKey,
    selectedVariantId,
    setSelectedVariantId,
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
    activeVariantCount,
    updateCurrentVariant,
    handleSelectTemplate,
    handleAddVariant,
    handleMoveVariant,
    handleDeleteVariant,
    handleDiscardCurrent,
    clearDraft,
    rebaseDraftOnSaved,
  };
}
