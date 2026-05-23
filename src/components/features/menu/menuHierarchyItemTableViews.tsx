'use client';

import { Plus } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { GbpDriftBadge } from '@/components/features/restaurant-settings/gbpDriftBadges';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { itemDescription, moneyLabel, primaryLabel } from './menuHierarchyDomain';
import { DesktopItemTable } from './menuHierarchyItemDesktopTable';
import { ItemActions, ItemHealthBadge, ItemThumbnail } from './menuHierarchyItemRows';
import {
  AvailabilityBadges,
  MenuItemOptions,
  type ItemTableViewProps,
} from './menuHierarchyItemTableShared';

export function MenuItemResponsiveViews(props: ItemTableViewProps) {
  const { section } = props;

  return (
    <>
      {section.items.length === 0 ? <MenuItemEmptyState onCreateItem={props.onCreateItem} /> : null}
      {section.items.length > 0 ? (
        <>
          <MobileItemList {...props} />
          <DesktopItemTable {...props} />
        </>
      ) : null}
    </>
  );
}

function MenuItemEmptyState({ onCreateItem }: { readonly onCreateItem: () => void }) {
  return (
    <div className="p-6">
      <OpsEmptyState
        title="No items in this section"
        description="Create the first item for this menu section."
        action={
          <Button type="button" onClick={onCreateItem}>
            <Plus data-icon="inline-start" aria-hidden />
            Create item
          </Button>
        }
      />
    </div>
  );
}

function MobileItemList({
  getItemGbpDriftFields,
  itemPatchPending,
  onCreateOption,
  onDeleteItem,
  onDeleteOption,
  onEditItem,
  onEditOption,
  onMoveItem,
  onMoveOption,
  onQuickEditItem,
  onToggleItemActive,
  optionPatchPending,
  section,
}: ItemTableViewProps) {
  return (
    <ul data-testid="mobile-item-list" className="flex flex-col divide-y md:hidden">
      {section.items.map((item, itemIndex) => (
        <li key={item.id} className="flex flex-col gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <ItemThumbnail item={item} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {primaryLabel(item, 'Menu item')}
                </span>
                <GbpDriftBadge fields={getItemGbpDriftFields(item)} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground text-pretty">
                {itemDescription(item)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="tabular-nums">{moneyLabel(item.attributes)}</span>
                <ItemHealthBadge item={item} />
              </div>
            </div>
            <ItemActions
              item={item}
              itemIndex={itemIndex}
              itemsCount={section.items.length}
              patchPending={itemPatchPending}
              onQuickEditItem={onQuickEditItem}
              onEditItem={onEditItem}
              onMoveItem={onMoveItem}
              onDeleteItem={onDeleteItem}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AvailabilityBadges item={item} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 p-3">
            <span className="text-xs font-medium uppercase text-muted-foreground">Status</span>
            <Switch
              checked={item.active}
              disabled={itemPatchPending}
              aria-label={`Set ${primaryLabel(item, 'Menu item')} active`}
              onCheckedChange={(checked) => onToggleItemActive(item, checked)}
            />
          </div>
          <div className="rounded-md bg-muted/30 p-2">
            <MenuItemOptions
              item={item}
              optionPatchPending={optionPatchPending}
              onCreateOption={onCreateOption}
              onEditOption={onEditOption}
              onDeleteOption={onDeleteOption}
              onMoveOption={onMoveOption}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
