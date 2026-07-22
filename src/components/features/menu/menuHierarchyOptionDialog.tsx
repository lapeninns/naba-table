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
import { Text } from '@/components/ui/typography';
import {
  useOpsCreateRestaurantMenuOption,
  useOpsPatchRestaurantMenuOption,
} from '@/hooks/ops/useOpsMenuHierarchy';

import {
  buildOptionPayload,
  optionInitialState,
  type OptionFormState,
} from './menuHierarchyDomain';
import {
  OptionActiveField,
  OptionGoogleAttributeFields,
  OptionIdentityFields,
  OptionMediaFields,
  OptionParentSummary,
} from './menuHierarchyOptionFields';
import { OptionPortionNutritionFields } from './menuHierarchyOptionPortionNutritionFields';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  RestaurantMenuOptionInput,
} from '@/server/menu-hierarchy/types';

export function OptionDialog({
  restaurantId,
  menu,
  section,
  item,
  option,
  onOpenChange,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu | null;
  section: CanonicalRestaurantMenuSection | null;
  item: CanonicalRestaurantMenuItem | null;
  option: CanonicalRestaurantMenuOption | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = useState<OptionFormState>(() => optionInitialState(option));
  const createOption = useOpsCreateRestaurantMenuOption({
    restaurantId,
    menuId: menu?.id,
    sectionId: section?.id,
    itemId: item?.id,
  });
  const updateOption = useOpsPatchRestaurantMenuOption(restaurantId);

  useEffect(() => {
    if (item) setState(optionInitialState(option));
  }, [item, option]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;
    const payload = buildOptionPayload(state, option?.displayOrder ?? item.options.length, option);
    if (option?.id && menu?.id && section?.id && item.id) {
      await updateOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: option.id,
        payload,
      });
    } else {
      await createOption.mutateAsync(payload as RestaurantMenuOptionInput);
    }
    onOpenChange(false);
  };
  const pending = createOption.isPending || updateOption.isPending;
  const error = createOption.error ?? updateOption.error;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{option ? 'Edit item option' : 'Add item option'}</DialogTitle>
          <DialogDescription>
            Google options are required variant choices and remain separate from internal modifier
            groups.
          </DialogDescription>
        </DialogHeader>
        <FormRoot className="flex flex-col gap-4" onSubmit={submit}>
          {item ? <OptionParentSummary item={item} /> : null}
          <OptionIdentityFields setState={setState} state={state} />
          <OptionGoogleAttributeFields setState={setState} state={state} />
          <OptionPortionNutritionFields setState={setState} state={state} />
          <OptionMediaFields setState={setState} state={state} />
          <OptionActiveField setState={setState} state={state} />
          {error ? (
            <Text variant="caption" className="text-destructive">
              {error.message}
            </Text>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !item}>
              {pending ? 'Saving...' : option ? 'Save option' : 'Add option'}
            </Button>
          </DialogFooter>
        </FormRoot>
      </DialogContent>
    </Dialog>
  );
}
