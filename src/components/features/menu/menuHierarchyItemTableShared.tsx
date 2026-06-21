'use client';

import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { OptionRow, availabilityBadges } from './menuHierarchyItemRows';

import type {
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export type ItemTableViewProps = {
  readonly section: CanonicalRestaurantMenuSection;
  readonly itemPatchPending: boolean;
  readonly optionPatchPending: boolean;
  readonly getItemGbpDriftFields: (
    item: CanonicalRestaurantMenuItem,
  ) => ReadonlyArray<DualSyncFieldSummary>;
  readonly onCreateItem: () => void;
  readonly onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  readonly onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
  readonly onDeleteOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => Promise<void>;
  readonly onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  readonly onEditOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
  readonly onMoveItem: (
    item: CanonicalRestaurantMenuItem,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  readonly onMoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  readonly onQuickEditItem: (item: CanonicalRestaurantMenuItem) => void;
  readonly onToggleItemActive: (item: CanonicalRestaurantMenuItem, active: boolean) => void;
};

export function MenuItemOptions({
  item,
  onCreateOption,
  onDeleteOption,
  onEditOption,
  onMoveOption,
  optionPatchPending,
}: {
  readonly item: CanonicalRestaurantMenuItem;
  readonly onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  readonly onDeleteOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => Promise<void>;
  readonly onEditOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
  readonly onMoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  readonly optionPatchPending: boolean;
}) {
  if (item.options.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-9 w-fit text-muted-foreground"
        onClick={() => onCreateOption(item)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add option
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.options.map((option, optionIndex) => (
        <OptionRow
          key={option.id ?? option.externalOptionId}
          item={item}
          option={option}
          optionIndex={optionIndex}
          optionsCount={item.options.length}
          onEditOption={onEditOption}
          onMoveOption={onMoveOption}
          onRemoveOption={onDeleteOption}
          patchPending={optionPatchPending}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-8 px-2 text-xs text-muted-foreground"
        onClick={() => onCreateOption(item)}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Option
      </Button>
    </div>
  );
}

export function AvailabilityBadges({ item }: { readonly item: CanonicalRestaurantMenuItem }) {
  return (
    <>
      {availabilityBadges(item).map(({ label, variant, Icon }) => (
        <Badge key={label} variant={variant} className="gap-1.5">
          <Icon aria-hidden />
          {label}
        </Badge>
      ))}
    </>
  );
}
