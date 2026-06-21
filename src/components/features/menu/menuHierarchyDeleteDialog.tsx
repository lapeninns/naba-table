'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useOpsDeleteRestaurantMenu,
  useOpsDeleteRestaurantMenuItem,
  useOpsDeleteRestaurantMenuOption,
  useOpsDeleteRestaurantMenuSection,
} from '@/hooks/ops/useOpsMenuHierarchy';

import { primaryLabel } from './menuHierarchyDomain';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

export type MenuHierarchyDeleteTarget =
  | { type: 'menu'; menu: CanonicalRestaurantMenu }
  | { type: 'section'; menu: CanonicalRestaurantMenu; section: CanonicalRestaurantMenuSection }
  | {
      type: 'item';
      menu: CanonicalRestaurantMenu;
      section: CanonicalRestaurantMenuSection;
      item: CanonicalRestaurantMenuItem;
    }
  | {
      type: 'option';
      menu: CanonicalRestaurantMenu;
      section: CanonicalRestaurantMenuSection;
      item: CanonicalRestaurantMenuItem;
      option: CanonicalRestaurantMenuOption;
    };

export function DeleteHierarchyDialog({
  restaurantId,
  target,
  onOpenChange,
}: {
  restaurantId: string;
  target: MenuHierarchyDeleteTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteMenu = useOpsDeleteRestaurantMenu(restaurantId);
  const deleteSection = useOpsDeleteRestaurantMenuSection(restaurantId);
  const deleteItem = useOpsDeleteRestaurantMenuItem(restaurantId);
  const deleteOption = useOpsDeleteRestaurantMenuOption(restaurantId);

  const pending =
    deleteMenu.isPending ||
    deleteSection.isPending ||
    deleteItem.isPending ||
    deleteOption.isPending;
  const error = deleteMenu.error ?? deleteSection.error ?? deleteItem.error ?? deleteOption.error;

  const targetName = (() => {
    if (!target) return 'item';
    if (target.type === 'menu') return primaryLabel(target.menu, 'Menu');
    if (target.type === 'section') return primaryLabel(target.section, 'Section');
    if (target.type === 'item') return primaryLabel(target.item, 'Menu item');
    return primaryLabel(target.option, 'Option');
  })();

  const targetLabel = target?.type ?? 'item';

  const confirm = async () => {
    if (!target) return;
    if (target.type === 'menu' && target.menu.id) {
      await deleteMenu.mutateAsync({ menuId: target.menu.id });
    }
    if (target.type === 'section' && target.menu.id && target.section.id) {
      await deleteSection.mutateAsync({ menuId: target.menu.id, sectionId: target.section.id });
    }
    if (target.type === 'item' && target.menu.id && target.section.id && target.item.id) {
      await deleteItem.mutateAsync({
        menuId: target.menu.id,
        sectionId: target.section.id,
        itemId: target.item.id,
      });
    }
    if (
      target.type === 'option' &&
      target.menu.id &&
      target.section.id &&
      target.item.id &&
      target.option.id
    ) {
      await deleteOption.mutateAsync({
        menuId: target.menu.id,
        sectionId: target.section.id,
        itemId: target.item.id,
        optionId: target.option.id,
      });
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {targetLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {targetName} from the restaurant menu structure. Publishing changes to
            Google is handled separately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? 'Deleting...' : `Delete ${targetLabel}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
