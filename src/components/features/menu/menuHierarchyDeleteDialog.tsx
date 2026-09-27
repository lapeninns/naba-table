'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import {
  useOpsDeleteRestaurantMenu,
  useOpsDeleteRestaurantMenuItem,
  useOpsDeleteRestaurantMenuOption,
  useOpsDeleteRestaurantMenuSection,
} from '@/hooks/ops/useOpsMenuHierarchy';

import { primaryLabel } from './menuHierarchyDomain';
import { DialogSaveError } from './menuHierarchyFormControls';

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
  const { reset: resetMenu } = deleteMenu;
  const { reset: resetSection } = deleteSection;
  const { reset: resetItem } = deleteItem;
  const { reset: resetOption } = deleteOption;
  const isOpen = Boolean(target);

  useEffect(() => {
    // Opening the dialog for a new target never shows the previous attempt's error.
    if (!isOpen) return;
    resetMenu();
    resetSection();
    resetItem();
    resetOption();
  }, [isOpen, target, resetMenu, resetSection, resetItem, resetOption]);

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
  const effect = (() => {
    if (!target) return '';
    if (target.type === 'menu') {
      const sectionCount = target.menu.sections.length;
      return sectionCount > 0
        ? `${targetName}, its ${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'} and their items are deleted from Nabatable.`
        : `${targetName} is deleted from Nabatable.`;
    }
    if (target.type === 'section') {
      const itemCount = target.section.items.length;
      return itemCount > 0
        ? `${targetName} and its ${itemCount} ${itemCount === 1 ? 'item' : 'items'} are deleted from this menu.`
        : `${targetName} is deleted from this menu.`;
    }
    if (target.type === 'item') {
      return `${targetName} is removed from this menu straight away.`;
    }
    return `${targetName} is removed from ${primaryLabel(target.item, 'this item')}.`;
  })();

  const confirm = async () => {
    if (!target) return;
    try {
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
    } catch {
      // The error renders inside the dialog; nothing was removed.
      return;
    }
    toast.success(`${targetName} deleted.`);
    onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      tone="destructive"
      title={`Delete ${targetName}?`}
      description={`${effect} This can’t be undone. Publishing to Google happens separately.`}
      confirmLabel={`Delete ${targetLabel}`}
      pending={pending}
      pendingLabel="Deleting…"
      keepOpenOnConfirm
      onConfirm={() => void confirm()}
    >
      <DialogSaveError error={error} message="Not deleted. Nothing was removed." />
    </ConfirmDialog>
  );
}
