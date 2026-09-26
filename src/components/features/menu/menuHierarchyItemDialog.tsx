'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';
import { useSettingsDiscardGuard } from '@/components/features/restaurant-settings/shared/useSettingsDiscardGuard';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Text } from '@/components/ui/typography';
import {
  useOpsCreateRestaurantMenuItem,
  useOpsUpdateRestaurantMenuItem,
} from '@/hooks/ops/useOpsMenuHierarchy';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';

import {
  buildItemPayload,
  itemInitialState,
  looksLikeLocalMediaUrl,
  primaryLabel,
  splitTokens,
  type ItemFormState,
} from './menuHierarchyDomain';
import { DialogFooterActions, FieldDisclosure } from './menuHierarchyFormControls';
import { GoogleItemDetailsFields, ItemEssentialsFields } from './menuHierarchyItemGoogleFields';
import { GoogleItemPublishingFields } from './menuHierarchyItemGooglePublishingFields';
import {
  CustomizationFields,
  DrinkDetailsFields,
  ImportMetadataFields,
  ItemAvailabilityDetailsFields,
  ItemAvailabilityFields,
  RecommendationFields,
} from './menuHierarchyItemOperationalFields';
import { ItemOptionsList, type ItemOptionCallbacks } from './menuHierarchyItemOptionsList';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuSection,
  RestaurantMenuItemInput,
} from '@/server/menu-hierarchy/types';

/**
 * One create request: its idempotency key and, once sent, the draft it carried (without the
 * generated external id) and that external id, so a retry of the same draft is byte-identical.
 */
type CreateAttempt = {
  key: string;
  sent: { draftFingerprint: string; externalItemId: string } | null;
};

function newCreateAttempt(): CreateAttempt {
  return { key: generateIdempotencyKey(), sent: null };
}

const NO_OPTION_CALLBACKS: ItemOptionCallbacks = {
  onCreateOption: () => undefined,
  onEditOption: () => undefined,
  onDeleteOption: () => undefined,
};

export function ItemDialog({
  restaurantId,
  menu,
  section,
  item,
  liveItem,
  open,
  onOpenChange,
  onCreated,
  optionCallbacks = NO_OPTION_CALLBACKS,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  section: CanonicalRestaurantMenuSection | null;
  /** Snapshot the form was opened with. A refetch never resets the draft. */
  item: CanonicalRestaurantMenuItem | null;
  /** Latest saved copy of the item, used for its options list. Defaults to `item`. */
  liveItem?: CanonicalRestaurantMenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called with the saved item after a create. When set, the dialog stays open and the parent
   * switches it to edit that item, so options can be added straight away.
   */
  onCreated?: (item: CanonicalRestaurantMenuItem) => void;
  optionCallbacks?: ItemOptionCallbacks;
}) {
  const formId = useId();
  const [state, setState] = useState<ItemFormState>(() => itemInitialState(item, menu?.menuKind));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaKeyDraft, setMediaKeyDraft] = useState('');
  const [googleDetailsOpen, setGoogleDetailsOpen] = useState(false);
  const createItem = useOpsCreateRestaurantMenuItem(restaurantId);
  const updateItem = useOpsUpdateRestaurantMenuItem(restaurantId);
  const { reset: resetCreate } = createItem;
  const { reset: resetUpdate } = updateItem;
  // One key per create request, reused by retries of the same draft, so a retried create never
  // duplicates the item. The server binds the key to the exact payload and refuses an edited one
  // (409 IDEMPOTENCY_KEY_REUSED), so a draft edited after a failed attempt gets a new key, and a
  // retry resends the first attempt's generated external id so its payload is identical.
  const createAttemptRef = useRef<CreateAttempt>(newCreateAttempt());

  useEffect(() => {
    if (open) {
      setState(itemInitialState(item, menu?.menuKind));
      setMediaError(null);
      setMediaKeyDraft('');
      setGoogleDetailsOpen(false);
      resetCreate();
      resetUpdate();
      if (!item) createAttemptRef.current = newCreateAttempt();
    }
  }, [item, menu?.menuKind, open, resetCreate, resetUpdate]);

  const initial = useMemo(() => itemInitialState(item, menu?.menuKind), [item, menu?.menuKind]);
  const isDirty =
    open && (JSON.stringify(state) !== JSON.stringify(initial) || mediaKeyDraft.trim() !== '');
  const { guardOpenChange } = useSettingsDiscardGuard('menu-item-dialog', isDirty);
  const requestOpenChange = guardOpenChange(onOpenChange);

  const mediaKeys = splitTokens(state.googleMediaKeys);
  const optionsItem = liveItem ?? item;
  const isDrinksMenu = menu?.menuKind === 'drinks';

  const addMediaKey = () => {
    const nextKey = mediaKeyDraft.trim();
    if (!nextKey) return;
    if (looksLikeLocalMediaUrl(nextKey)) {
      setMediaError('Google media keys cannot be image URLs.');
      return;
    }
    setMediaError(null);
    setState((current) => ({
      ...current,
      googleMediaKeys: [...new Set([...splitTokens(current.googleMediaKeys), nextKey])].join('\n'),
    }));
    setMediaKeyDraft('');
  };

  const removeMediaKey = (key: string) => {
    setState((current) => ({
      ...current,
      googleMediaKeys: splitTokens(current.googleMediaKeys)
        .filter((entry) => entry !== key)
        .join('\n'),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!menu || !section) return;
    const googleMediaKeys = splitTokens(state.googleMediaKeys);
    if (googleMediaKeys.some(looksLikeLocalMediaUrl)) {
      setMediaError(
        'Google media keys cannot be image URLs. Put local URLs in the local image field.',
      );
      // The field lives in a collapsed group: open it so the error is visible.
      setGoogleDetailsOpen(true);
      return;
    }
    if (!menu.id || !section.id) return;
    // No display order: new items are appended by the server, and an edit keeps the saved order.
    const payload = buildItemPayload({ state, menuKind: menu.menuKind, existing: item });
    const savedName = state.displayName.trim() || 'Item';
    if (item?.id) {
      try {
        await updateItem.mutateAsync({
          menuId: menu.id,
          sectionId: section.id,
          itemId: item.id,
          payload,
        });
      } catch {
        return;
      }
      toast.success(`${savedName} saved.`);
      onOpenChange(false);
      return;
    }

    const createPayload = payload as RestaurantMenuItemInput;
    const { externalItemId: generatedExternalId, ...draftFields } = createPayload;
    const draftFingerprint = JSON.stringify({
      menuId: menu.id,
      sectionId: section.id,
      draft: draftFields,
    });
    let attempt = createAttemptRef.current;
    if (attempt.sent && attempt.sent.draftFingerprint !== draftFingerprint) {
      attempt = newCreateAttempt();
    }
    attempt.sent ??= { draftFingerprint, externalItemId: generatedExternalId };
    createAttemptRef.current = attempt;

    let created: CanonicalRestaurantMenuItem;
    try {
      created = await createItem.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        payload: {
          ...createPayload,
          externalItemId: attempt.sent.externalItemId,
          idempotencyKey: attempt.key,
        },
      });
    } catch {
      return;
    }
    if (onCreated) {
      toast.success(`${savedName} added. You can add options now.`);
      onCreated(created);
      return;
    }
    toast.success(`${savedName} added.`);
    onOpenChange(false);
  };

  const pending = createItem.isPending || updateItem.isPending;
  const error = createItem.error ?? updateItem.error;
  const title = item
    ? `Edit ${primaryLabel(item, 'item')}`
    : `Add item to ${section ? primaryLabel(section, 'section') : 'section'}`;

  return (
    <SettingsDialog
      open={open}
      onOpenChange={requestOpenChange}
      size="lg"
      testId="menu-item-dialog"
      title={title}
      description="Saves when you select Save item. Publishing to Google happens separately."
      footer={
        <DialogFooterActions error={error}>
          <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending || !menu || !section}>
            {pending ? 'Saving…' : 'Save item'}
          </Button>
        </DialogFooterActions>
      }
    >
      <FormRoot id={formId} className="flex flex-col gap-5" onSubmit={submit}>
        <ItemEssentialsFields setState={setState} state={state} />
        <ItemAvailabilityFields setState={setState} state={state} />

        <div className="flex flex-col gap-3">
          <FieldDisclosure
            title="Options guests can choose"
            hint={
              optionsItem?.id
                ? `${optionsItem.options.length} ${optionsItem.options.length === 1 ? 'option' : 'options'}`
                : 'Available after the item is saved'
            }
          >
            <ItemOptionsList
              restaurantId={restaurantId}
              menu={menu}
              section={section}
              item={optionsItem}
              {...optionCallbacks}
            />
          </FieldDisclosure>

          <FieldDisclosure
            title="Google details"
            hint="Photos, spiciness, portion, nutrition, preparation and ingredients"
            open={googleDetailsOpen}
            onOpenChange={setGoogleDetailsOpen}
          >
            <GoogleItemPublishingFields
              mediaError={mediaError}
              mediaKeyDraft={mediaKeyDraft}
              mediaKeys={mediaKeys}
              onAddMediaKey={addMediaKey}
              onMediaKeyDraftChange={setMediaKeyDraft}
              onRemoveMediaKey={removeMediaKey}
              setState={setState}
              state={state}
            />
            <GoogleItemDetailsFields setState={setState} state={state} />
          </FieldDisclosure>

          {isDrinksMenu ? (
            <FieldDisclosure
              title="Drink details"
              hint="ABV, volume, style, region and contents"
              defaultOpen
            >
              <DrinkDetailsFields setState={setState} state={state} />
            </FieldDisclosure>
          ) : null}

          <FieldDisclosure
            title="More"
            hint="Availability details, recommendations, customisation and import details"
          >
            <section className="flex flex-col gap-4">
              <Text variant="subheading" as="h3">
                Availability details
              </Text>
              <ItemAvailabilityDetailsFields setState={setState} state={state} />
            </section>
            <RecommendationFields setState={setState} state={state} />
            <CustomizationFields setState={setState} state={state} />
            <ImportMetadataFields setState={setState} state={state} />
          </FieldDisclosure>
        </div>
      </FormRoot>
    </SettingsDialog>
  );
}
