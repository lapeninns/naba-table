'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormRoot } from '@/components/ui/form';
import {
  useOpsCreateRestaurantMenuItem,
  useOpsUpdateRestaurantMenuItem,
} from '@/hooks/ops/useOpsMenuHierarchy';

import {
  buildItemPayload,
  itemInitialState,
  looksLikeLocalMediaUrl,
  splitTokens,
  type ItemFormState,
} from './menuHierarchyDomain';
import { GoogleItemEssentialsFields } from './menuHierarchyItemGoogleFields';
import { GoogleItemPublishingFields } from './menuHierarchyItemGooglePublishingFields';
import {
  CustomizationFields,
  DrinkDetailsFields,
  GuestMenuItemFields,
  ImportMetadataFields,
  RecommendationFields,
} from './menuHierarchyItemOperationalFields';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuSection,
  RestaurantMenuItemInput,
} from '@/server/menu-hierarchy/types';

export function ItemDialog({
  restaurantId,
  menu,
  section,
  item,
  open,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  section: CanonicalRestaurantMenuSection | null;
  item: CanonicalRestaurantMenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<ItemFormState>(() => itemInitialState(item, menu?.menuKind));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaKeyDraft, setMediaKeyDraft] = useState('');
  const createItem = useOpsCreateRestaurantMenuItem({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
  });
  const updateItem = useOpsUpdateRestaurantMenuItem({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
    itemId: item?.id,
  });

  useEffect(() => {
    if (open) {
      setState(itemInitialState(item, menu?.menuKind));
      setMediaError(null);
      setMediaKeyDraft('');
    }
  }, [item, menu?.menuKind, open]);

  const mediaKeys = splitTokens(state.googleMediaKeys);

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
      return;
    }
    const payload = buildItemPayload({
      state,
      menuKind: menu.menuKind,
      displayOrder: item?.displayOrder ?? section.items.length,
      existing: item,
    });
    if (item?.id) {
      await updateItem.mutateAsync(payload);
    } else {
      await createItem.mutateAsync(payload as RestaurantMenuItemInput);
    }
    onOpenChange(false);
  };

  const pending = createItem.isPending || updateItem.isPending;
  const error = createItem.error ?? updateItem.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Create item'}</DialogTitle>
          <DialogDescription>
            Details that can be published to Google are grouped above internal operations metadata.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-5" onSubmit={submit}>
          <GoogleItemEssentialsFields setState={setState} state={state} />
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

          <GuestMenuItemFields setState={setState} state={state} />
          {menu?.menuKind === 'drinks' ? (
            <DrinkDetailsFields setState={setState} state={state} />
          ) : null}
          <RecommendationFields setState={setState} state={state} />
          <CustomizationFields setState={setState} state={state} />
          <ImportMetadataFields setState={setState} state={state} />

          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !menu || !section}>
              {pending ? 'Saving...' : 'Save item'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
