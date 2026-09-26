'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { useOpsReorderMenuChildren } from '@/hooks/ops/useOpsMenuHierarchy';

import { OptionRow } from './menuHierarchyItemRows';
import { movedIds } from './menuHierarchyOrder';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';

export type ItemOptionCallbacks = {
  readonly onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  readonly onEditOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
  readonly onDeleteOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
};

/**
 * Options guests can choose for a saved item. Each option opens the option dialog; moving an
 * option sends one reorder command for the item's options.
 */
export function ItemOptionsList({
  restaurantId,
  menu,
  section,
  item,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  readonly restaurantId: string;
  readonly menu: CanonicalRestaurantMenu | null;
  readonly section: CanonicalRestaurantMenuSection | null;
  readonly item: CanonicalRestaurantMenuItem | null;
} & ItemOptionCallbacks) {
  const reorder = useOpsReorderMenuChildren(restaurantId);

  if (!item?.id) {
    return (
      <Text variant="caption">Save the item first, then add options such as a large portion.</Text>
    );
  }

  const moveOption = (index: number, direction: -1 | 1) => {
    const orderedIds = movedIds(item.options, index, direction);
    if (!menu?.id || !section?.id || !item.id || !orderedIds) return;
    reorder.mutate({
      target: { level: 'options', menuId: menu.id, sectionId: section.id, itemId: item.id },
      orderedIds,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {item.options.length === 0 ? (
        <Text variant="caption">No options yet, for example “Large portion”.</Text>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {item.options.map((option, optionIndex) => (
            <OptionRow
              key={option.id ?? option.externalOptionId}
              item={item}
              option={option}
              optionIndex={optionIndex}
              optionsCount={item.options.length}
              onEditOption={onEditOption}
              onMoveOption={(_item, _entry, index, direction) => moveOption(index, direction)}
              onRemoveOption={async (target, entry) => onDeleteOption(target, entry)}
              patchPending={reorder.isPending}
            />
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit [@media(pointer:coarse)]:min-h-11"
        onClick={() => onCreateOption(item)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add option
      </Button>
    </div>
  );
}
