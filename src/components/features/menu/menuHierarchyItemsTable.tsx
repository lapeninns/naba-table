'use client';

import { useState } from 'react';

import { findFoodMenuItemDriftField } from '@/components/features/restaurant-settings/gbpDriftDomain';
import {
  useOpsPatchRestaurantMenuItem,
  useOpsPatchRestaurantMenuOption,
} from '@/hooks/ops/useOpsMenuHierarchy';

import { primaryLabel } from './menuHierarchyDomain';
import { MenuItemResponsiveViews } from './menuHierarchyItemTableViews';
import { QuickEditItemDialog } from './menuHierarchyQuickEditItemDialog';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  RestaurantMenuItemPatch,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export function ItemTable({
  restaurantId,
  menu,
  section,
  gbpDriftFields,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  onCreateItem: () => void;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => void;
  onDeleteOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
}) {
  const patchItem = useOpsPatchRestaurantMenuItem(restaurantId);
  const patchOption = useOpsPatchRestaurantMenuOption(restaurantId);
  const [quickEditItem, setQuickEditItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  const quickEditDriftField = quickEditItem
    ? findFoodMenuItemDriftField(gbpDriftFields, {
        menuId: menu.id,
        menuLabel: primaryLabel(menu, 'Menu'),
        sectionId: section.id,
        sectionLabel: primaryLabel(section, 'Section'),
        externalItemId: quickEditItem.externalItemId,
        itemId: quickEditItem.id,
      })
    : null;
  const getItemGbpDriftFields = (item: CanonicalRestaurantMenuItem) => {
    const field = findFoodMenuItemDriftField(gbpDriftFields, {
      menuId: menu.id,
      menuLabel: primaryLabel(menu, 'Menu'),
      sectionId: section.id,
      sectionLabel: primaryLabel(section, 'Section'),
      externalItemId: item.externalItemId,
      itemId: item.id,
    });
    return field ? [field] : [];
  };

  const moveItem = async (item: CanonicalRestaurantMenuItem, index: number, direction: -1 | 1) => {
    const target = section.items[index + direction];
    if (!menu.id || !section.id || !item.id || !target?.id) return;
    await Promise.all([
      patchItem.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchItem.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: target.id,
        payload: { displayOrder: item.displayOrder },
      }),
    ]);
  };

  const moveOption = async (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => {
    const target = item.options[index + direction];
    if (!menu.id || !section.id || !item.id || !option.id || !target?.id) return;
    await Promise.all([
      patchOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: option.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchOption.mutateAsync({
        menuId: menu.id,
        sectionId: section.id,
        itemId: item.id,
        optionId: target.id,
        payload: { displayOrder: option.displayOrder },
      }),
    ]);
  };

  const removeOption = async (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => {
    if (!menu.id || !section.id || !item.id || !option.id) return;
    onDeleteOption(item, option);
  };

  const toggleItemActive = async (item: CanonicalRestaurantMenuItem, active: boolean) => {
    if (!menu.id || !section.id || !item.id) return;
    await patchItem.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      payload: { active },
    });
  };

  const quickPatchItem = async (
    item: CanonicalRestaurantMenuItem,
    payload: RestaurantMenuItemPatch,
  ) => {
    if (!menu.id || !section.id || !item.id) return;
    await patchItem.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      payload,
    });
  };

  return (
    <div className="min-w-0 bg-background">
      <MenuItemResponsiveViews
        section={section}
        itemPatchPending={patchItem.isPending}
        optionPatchPending={patchOption.isPending}
        getItemGbpDriftFields={getItemGbpDriftFields}
        onCreateItem={onCreateItem}
        onCreateOption={onCreateOption}
        onDeleteItem={onDeleteItem}
        onDeleteOption={removeOption}
        onEditItem={onEditItem}
        onEditOption={onEditOption}
        onMoveItem={moveItem}
        onMoveOption={moveOption}
        onQuickEditItem={setQuickEditItem}
        onToggleItemActive={(item, active) => void toggleItemActive(item, active)}
      />
      <QuickEditItemDialog
        gbpDriftField={quickEditDriftField}
        item={quickEditItem}
        open={quickEditItem !== null}
        pending={patchItem.isPending}
        onOpenChange={(open) => {
          if (!open) setQuickEditItem(null);
        }}
        onSubmit={async (item, payload) => {
          await quickPatchItem(item, payload);
          setQuickEditItem(null);
        }}
      />
    </div>
  );
}
