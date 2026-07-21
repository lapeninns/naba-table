'use client';

import { GbpDriftBadge } from '@/components/features/restaurant-settings/gbpDriftBadges';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/typography';

import { itemDescription, moneyLabel, primaryLabel } from './menuHierarchyDomain';
import { ItemActions, ItemThumbnail } from './menuHierarchyItemRows';
import {
  AvailabilityBadges,
  MenuItemOptions,
  type ItemTableViewProps,
} from './menuHierarchyItemTableShared';

export function DesktopItemTable({
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
    <div className="hidden overflow-x-auto md:block">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="min-w-[28rem]">Item details</TableHead>
            <TableHead className="w-40">Price</TableHead>
            <TableHead className="min-w-64">Availability</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-16 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.items.map((item, itemIndex) => (
            <TableRow key={item.id} className="group hover:bg-muted/20">
              <TableCell>
                <div className="flex min-w-0 items-center gap-4">
                  <ItemThumbnail item={item} />
                  <div className="min-w-0">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto max-w-full justify-start truncate p-0 text-left text-base font-semibold text-foreground hover:bg-transparent hover:text-primary"
                      onClick={() => onEditItem(item)}
                    >
                      {primaryLabel(item, 'Menu item')}
                    </Button>
                    <GbpDriftBadge fields={getItemGbpDriftFields(item)} />
                    <Text variant="caption" className="mt-1 line-clamp-2 max-w-xl leading-5 text-pretty">
                      {itemDescription(item)}
                    </Text>
                    <div className="mt-2">
                      <MenuItemOptions
                        item={item}
                        optionPatchPending={optionPatchPending}
                        onCreateOption={onCreateOption}
                        onEditOption={onEditOption}
                        onDeleteOption={onDeleteOption}
                        onMoveOption={onMoveOption}
                      />
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-base font-semibold tabular-nums">
                  {moneyLabel(item.attributes)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex max-w-sm flex-wrap gap-1.5">
                  <AvailabilityBadges item={item} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.active}
                    disabled={itemPatchPending}
                    aria-label={`Set ${primaryLabel(item, 'Menu item')} active`}
                    onCheckedChange={(checked) => onToggleItemActive(item, checked)}
                  />
                  <span className="sr-only">{item.active ? 'Active' : 'Inactive'}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
