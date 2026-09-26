'use client';

import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { SettingsDialog } from '@/components/features/restaurant-settings/shared/SettingsDialog';
import { useSettingsDiscardGuard } from '@/components/features/restaurant-settings/shared/useSettingsDiscardGuard';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import {
  useOpsCreateRestaurantMenuOption,
  useOpsUpdateRestaurantMenuOption,
} from '@/hooks/ops/useOpsMenuHierarchy';

import {
  buildOptionPayload,
  optionInitialState,
  type OptionFormState,
} from './menuHierarchyDomain';
import { DialogFooterActions } from './menuHierarchyFormControls';
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
  const formId = useId();
  const [state, setState] = useState<OptionFormState>(() => optionInitialState(option));
  const createOption = useOpsCreateRestaurantMenuOption(restaurantId);
  const updateOption = useOpsUpdateRestaurantMenuOption(restaurantId);
  const { reset: resetCreate } = createOption;
  const { reset: resetUpdate } = updateOption;

  useEffect(() => {
    if (!item) return;
    setState(optionInitialState(option));
    resetCreate();
    resetUpdate();
  }, [item, option, resetCreate, resetUpdate]);

  const initial = useMemo(() => optionInitialState(option), [option]);
  const isDirty = Boolean(item) && JSON.stringify(state) !== JSON.stringify(initial);
  const { guardOpenChange } = useSettingsDiscardGuard('menu-option-dialog', isDirty);
  const requestOpenChange = guardOpenChange(onOpenChange);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item?.id || !menu?.id || !section?.id) return;
    // No display order: new options are appended by the server, edits keep the saved order.
    const payload = buildOptionPayload(state, undefined, option);
    const ids = { menuId: menu.id, sectionId: section.id, itemId: item.id };
    try {
      if (option?.id) {
        await updateOption.mutateAsync({ ...ids, optionId: option.id, payload });
      } else {
        await createOption.mutateAsync({ ...ids, payload: payload as RestaurantMenuOptionInput });
      }
    } catch {
      return;
    }
    toast.success(option?.id ? 'Option saved.' : 'Option added.');
    onOpenChange(false);
  };
  const pending = createOption.isPending || updateOption.isPending;
  const error = createOption.error ?? updateOption.error;

  return (
    <SettingsDialog
      open={Boolean(item)}
      onOpenChange={requestOpenChange}
      size="lg"
      testId="menu-option-dialog"
      title={option ? 'Edit item option' : 'Add item option'}
      description="Options guests can choose, such as a large portion. Saves when you select Save option."
      footer={
        <DialogFooterActions error={error}>
          <Button type="button" variant="outline" onClick={() => requestOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={pending || !item}>
            {pending ? 'Saving…' : option ? 'Save option' : 'Add option'}
          </Button>
        </DialogFooterActions>
      }
    >
      <FormRoot id={formId} className="flex flex-col gap-4" onSubmit={submit}>
        {item ? <OptionParentSummary item={item} /> : null}
        <OptionIdentityFields setState={setState} state={state} />
        <OptionGoogleAttributeFields setState={setState} state={state} />
        <OptionPortionNutritionFields setState={setState} state={state} />
        <OptionMediaFields setState={setState} state={state} />
        <OptionActiveField setState={setState} state={state} />
      </FormRoot>
    </SettingsDialog>
  );
}
