'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { findFoodMenuItemDriftField } from '@/components/features/restaurant-settings/gbpDriftDomain';
import { Text } from '@/components/ui/typography';
import {
  useOpsReorderMenuChildren,
  useOpsUpdateRestaurantMenuItem,
} from '@/hooks/ops/useOpsMenuHierarchy';

import { primaryLabel } from './menuHierarchyDomain';
import { MenuItemRow } from './menuHierarchyItemRows';
import { movedIds } from './menuHierarchyOrder';
import { QuickEditItemDialog } from './menuHierarchyQuickEditItemDialog';
import { runMenuMutation, withReasonCode } from './menuMutationFeedback';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuSection,
  RestaurantMenuItemPatch,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function ItemTable({
  restaurantId,
  menu,
  section,
  visibleItems = section.items,
  filterActive = false,
  gbpDriftFields,
  onEditItem,
  onDeleteItem,
  onCreateOption,
}: {
  restaurantId: string;
  menu: CanonicalRestaurantMenu;
  section: CanonicalRestaurantMenuSection;
  /** Items that match the page search and filter. Defaults to every item in the section. */
  visibleItems?: ReadonlyArray<CanonicalRestaurantMenuItem>;
  /** While filtering, reordering is off: neighbours may be hidden from view. */
  filterActive?: boolean;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
}) {
  // Separate mutation instances: a toggle in this section never makes quick edit look busy.
  const toggleItem = useOpsUpdateRestaurantMenuItem(restaurantId);
  const quickEdit = useOpsUpdateRestaurantMenuItem(restaurantId);
  const reorder = useOpsReorderMenuChildren(restaurantId);
  const [quickEditItem, setQuickEditItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  // Optimistic shown/hidden values, keyed by item id, until the saved hierarchy catches up.
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<string, boolean>>({});
  const [togglePendingIds, setTogglePendingIds] = useState<Record<string, true>>({});
  const quickEditPending =
    quickEdit.isPending &&
    Boolean(quickEditItem?.id) &&
    quickEdit.variables?.itemId === quickEditItem?.id;

  const driftFieldFor = (item: CanonicalRestaurantMenuItem) =>
    findFoodMenuItemDriftField(gbpDriftFields, {
      menuId: menu.id,
      menuLabel: primaryLabel(menu, 'Menu'),
      sectionId: section.id,
      sectionLabel: primaryLabel(section, 'Section'),
      externalItemId: item.externalItemId,
      itemId: item.id,
    });

  const moveItem = (index: number, direction: -1 | 1) => {
    const orderedIds = movedIds(section.items, index, direction);
    if (!menu.id || !section.id || !orderedIds) return;
    reorder.mutate({
      target: { level: 'items', menuId: menu.id, sectionId: section.id },
      orderedIds,
    });
  };

  const setItemActive = async (
    item: CanonicalRestaurantMenuItem,
    active: boolean,
    { isUndo = false }: { isUndo?: boolean } = {},
  ) => {
    if (!menu.id || !section.id || !item.id) return;
    const ids = { menuId: menu.id, sectionId: section.id, itemId: item.id };
    const itemId = item.id;
    const name = primaryLabel(item, 'Item');
    setVisibilityOverrides((current) => ({ ...current, [itemId]: active }));
    setTogglePendingIds((current) => ({ ...current, [itemId]: true }));
    try {
      await toggleItem.mutateAsync({ ...ids, payload: { active } });
      const message = `${name} ${active ? 'shown on' : 'hidden from'} the menu.`;
      toast.success(
        message,
        isUndo
          ? undefined
          : {
              action: {
                label: 'Undo',
                onClick: () => void setItemActive(item, !active, { isUndo: true }),
              },
            },
      );
    } catch (error) {
      toast.error(
        withReasonCode(
          `Could not ${active ? 'show' : 'hide'} ${name}. It is still ${active ? 'hidden' : 'shown'}.`,
          error,
        ),
      );
    } finally {
      // Success: the saved item is already in the cache. Failure: the saved value shows again.
      setVisibilityOverrides((current) => withoutKey(current, itemId));
      setTogglePendingIds((current) => withoutKey(current, itemId));
    }
  };

  const openQuickEdit = (item: CanonicalRestaurantMenuItem) => {
    quickEdit.reset();
    setQuickEditItem(item);
  };

  const quickPatchItem = async (
    item: CanonicalRestaurantMenuItem,
    payload: RestaurantMenuItemPatch,
  ) => {
    if (!menu.id || !section.id || !item.id) return;
    await quickEdit.mutateAsync({
      menuId: menu.id,
      sectionId: section.id,
      itemId: item.id,
      payload,
    });
  };

  if (section.items.length === 0) {
    return (
      <Text variant="caption" className="border-t border-border/60 px-4 py-3 sm:px-5">
        No items in this section yet.
      </Text>
    );
  }

  return (
    <>
      <ul className="flex flex-col" aria-label={`Items in ${primaryLabel(section, 'section')}`}>
        {visibleItems.map((savedItem) => {
          const override = savedItem.id ? visibilityOverrides[savedItem.id] : undefined;
          const item = override === undefined ? savedItem : { ...savedItem, active: override };
          return (
            <MenuItemRow
              key={savedItem.id ?? savedItem.externalItemId}
              item={item}
              itemIndex={section.items.indexOf(savedItem)}
              itemsCount={section.items.length}
              driftField={driftFieldFor(savedItem)}
              togglePending={Boolean(savedItem.id && togglePendingIds[savedItem.id])}
              moveDisabled={filterActive || reorder.isPending}
              onToggleActive={(target, active) => void setItemActive(savedItem, active)}
              onEditItem={() => onEditItem(savedItem)}
              onQuickEditItem={() => openQuickEdit(savedItem)}
              onCreateOption={() => onCreateOption(savedItem)}
              onMoveItem={(_target, index, direction) => moveItem(index, direction)}
              onDeleteItem={() => onDeleteItem(savedItem)}
            />
          );
        })}
      </ul>
      <QuickEditItemDialog
        gbpDriftField={quickEditItem ? driftFieldFor(quickEditItem) : null}
        item={quickEditItem}
        open={quickEditItem !== null}
        pending={quickEditPending}
        onOpenChange={(open) => {
          if (!open) setQuickEditItem(null);
        }}
        onSubmit={async (item, payload) => {
          const saved = await runMenuMutation(() => quickPatchItem(item, payload), {
            success: `${primaryLabel(item, 'Item')} updated.`,
            failure: 'Item not updated. Your edits are still in the dialog.',
          });
          if (saved) setQuickEditItem(null);
        }}
      />
    </>
  );
}
