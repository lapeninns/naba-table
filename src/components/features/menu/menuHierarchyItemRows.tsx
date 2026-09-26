'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useId } from 'react';

import { openSettingsCompare } from '@/components/features/restaurant-settings/gbp/openSettingsCompare';
import { useOptionalGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatGoogleFoodMenuEnumLabel as formatEnumLabel } from '@/lib/google-food-menu-labels';
import { cn } from '@/lib/utils';

import { moneyLabel, primaryDescription, primaryLabel } from './menuHierarchyDomain';
import {
  deriveItemReadiness,
  itemAvailabilityPolicy,
  itemServicesLabel,
} from './menuHierarchyItemDomain';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type {
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

/** "Differs from Google" badge; opens the Google compare view when the drift provider is present. */
export function ItemDriftBadge({ field }: { readonly field: DualSyncFieldSummary | null }) {
  const drift = useOptionalGbpDrift();
  if (!field) return null;
  const badge = (
    <Badge variant="status-pending" className="gap-1">
      <AlertTriangle className="size-3" aria-hidden />
      Differs from Google
    </Badge>
  );
  if (!drift) return badge;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto p-0 hover:bg-transparent"
      aria-label={`Differs from Google: compare ${field.label}`}
      onClick={() =>
        openSettingsCompare(drift.openCompare, {
          preset: 'field',
          fieldKey: field.fieldKey,
          sectionKey: field.sectionKey as DualSyncSectionKey,
        })
      }
    >
      {badge}
    </Button>
  );
}

export function ItemReadinessLine({ item }: { readonly item: CanonicalRestaurantMenuItem }) {
  const readiness = deriveItemReadiness(item);
  const Icon =
    readiness.status === 'ready'
      ? CheckCircle2
      : readiness.status === 'hidden'
        ? EyeOff
        : AlertCircle;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm',
        readiness.status === 'ready' && 'text-success-text',
        readiness.status === 'needs-attention' && 'text-warning-text',
        readiness.status === 'hidden' && 'text-muted-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {readiness.label}
    </span>
  );
}

export function ItemActions({
  item,
  itemIndex,
  itemsCount,
  moveDisabled,
  onQuickEditItem,
  onCreateOption,
  onMoveItem,
  onDeleteItem,
}: {
  item: CanonicalRestaurantMenuItem;
  itemIndex: number;
  itemsCount: number;
  moveDisabled: boolean;
  onQuickEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  onMoveItem: (
    item: CanonicalRestaurantMenuItem,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground [@media(pointer:coarse)]:size-11"
          aria-label={`Open item actions for ${primaryLabel(item, 'Menu item')}`}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onQuickEditItem(item)}>
            <SlidersHorizontal aria-hidden />
            Quick edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onCreateOption(item)}>
            <Plus aria-hidden />
            Add option
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex <= 0 || moveDisabled}
            onSelect={() => void onMoveItem(item, itemIndex, -1)}
          >
            <ArrowUp aria-hidden />
            Move item up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex === itemsCount - 1 || moveDisabled}
            onSelect={() => void onMoveItem(item, itemIndex, 1)}
          >
            <ArrowDown aria-hidden />
            Move item down
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDeleteItem(item)}>
            <Trash2 aria-hidden />
            Delete item
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type MenuItemRowProps = {
  readonly item: CanonicalRestaurantMenuItem;
  readonly itemIndex: number;
  readonly itemsCount: number;
  readonly driftField: DualSyncFieldSummary | null;
  readonly togglePending: boolean;
  readonly moveDisabled: boolean;
  readonly onToggleActive: (item: CanonicalRestaurantMenuItem, active: boolean) => void;
  readonly onEditItem: (item: CanonicalRestaurantMenuItem) => void;
  readonly onQuickEditItem: (item: CanonicalRestaurantMenuItem) => void;
  readonly onCreateOption: (item: CanonicalRestaurantMenuItem) => void;
  readonly onMoveItem: (
    item: CanonicalRestaurantMenuItem,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  readonly onDeleteItem: (item: CanonicalRestaurantMenuItem) => void;
};

/**
 * One menu item: details, price, services, Google readiness, and the shown/hidden switch.
 * Stacks on phones, two columns from `sm`, and five aligned columns from `xl`.
 */
export function MenuItemRow({
  item,
  itemIndex,
  itemsCount,
  driftField,
  togglePending,
  moveDisabled,
  onToggleActive,
  onEditItem,
  onQuickEditItem,
  onCreateOption,
  onMoveItem,
  onDeleteItem,
}: MenuItemRowProps) {
  const switchId = useId();
  const name = primaryLabel(item, 'Menu item');
  const description = primaryDescription(item).trim();
  const { soldOut, orderable } = itemAvailabilityPolicy(item);
  const dietary = item.attributes.dietaryRestriction ?? [];
  const allergens = item.attributes.allergen ?? [];

  return (
    <li
      data-testid={`menu-item-${item.id ?? item.externalItemId}`}
      className="grid gap-x-4 gap-y-2 border-t border-border/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 xl:grid-cols-[minmax(0,1fr)_5.5rem_9rem_13rem_auto] xl:items-center"
    >
      <div className="min-w-0 sm:col-start-1 sm:row-start-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'min-w-0 break-words font-semibold text-foreground',
              !item.active && 'text-muted-foreground',
            )}
          >
            {name}
          </span>
          {soldOut ? (
            <Badge variant="status-cancelled" className="gap-1">
              <AlertCircle className="size-3" aria-hidden />
              Sold out
            </Badge>
          ) : null}
          {!soldOut && !orderable ? (
            <Badge variant="outline" className="gap-1">
              <AlertCircle className="size-3" aria-hidden />
              Not orderable
            </Badge>
          ) : null}
          <ItemDriftBadge field={driftField} />
        </div>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
        {dietary.length > 0 || allergens.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {dietary.map((value) => (
              <Badge key={value} variant="secondary">
                {formatEnumLabel(value)}
              </Badge>
            ))}
            {allergens.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Allergens: {allergens.map(formatEnumLabel).join(', ')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:col-start-1 sm:row-start-2 xl:contents">
        <span className="font-mono tabular-nums xl:col-start-2 xl:row-start-1 xl:text-right">
          <span className="sr-only">Price </span>
          {moneyLabel(item.attributes)}
        </span>
        <span className="text-muted-foreground xl:col-start-3 xl:row-start-1">
          <span className="sr-only">Served at </span>
          {itemServicesLabel(item)}
        </span>
        <span className="xl:col-start-4 xl:row-start-1">
          <ItemReadinessLine item={item} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-end xl:col-start-5 xl:row-span-1">
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={item.active}
            disabled={togglePending}
            aria-label={`${name} shown on the menu`}
            onCheckedChange={(checked) => onToggleActive(item, checked)}
          />
          <Label
            htmlFor={switchId}
            className="w-12 text-sm font-normal text-muted-foreground"
            aria-hidden
          >
            {item.active ? 'Shown' : 'Hidden'}
          </Label>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="[@media(pointer:coarse)]:min-h-11"
            aria-label={`Edit ${name}`}
            onClick={() => onEditItem(item)}
          >
            <Pencil data-icon="inline-start" aria-hidden />
            Edit
          </Button>
          <ItemActions
            item={item}
            itemIndex={itemIndex}
            itemsCount={itemsCount}
            moveDisabled={moveDisabled}
            onQuickEditItem={onQuickEditItem}
            onCreateOption={onCreateOption}
            onMoveItem={onMoveItem}
            onDeleteItem={onDeleteItem}
          />
        </div>
      </div>
    </li>
  );
}

export function OptionRow({
  item,
  option,
  optionIndex,
  optionsCount,
  onEditOption,
  onMoveOption,
  onRemoveOption,
  patchPending,
}: {
  item: CanonicalRestaurantMenuItem;
  option: CanonicalRestaurantMenuOption;
  optionIndex: number;
  optionsCount: number;
  onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => void;
  onMoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
    index: number,
    direction: -1 | 1,
  ) => Promise<void>;
  onRemoveOption: (
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => Promise<void>;
  patchPending: boolean;
}) {
  const price = moneyLabel(option.attributes);
  return (
    <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-md border bg-background shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-8 min-w-0 justify-start gap-2 rounded-none px-2 text-left [@media(pointer:coarse)]:min-h-11"
        onClick={() => onEditOption(item, option)}
        aria-label={`Edit option ${primaryLabel(option, 'Option')}`}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {primaryLabel(option, 'Option')}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{price}</span>
        {!option.active ? (
          <Badge variant="outline" className="shrink-0">
            Hidden
          </Badge>
        ) : null}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-none border-l [@media(pointer:coarse)]:size-11"
            aria-label={`Open option actions for ${primaryLabel(option, 'Option')}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onEditOption(item, option)}>
              <Pencil aria-hidden />
              Edit option
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={optionIndex === 0 || patchPending}
              onSelect={() => void onMoveOption(item, option, optionIndex, -1)}
            >
              <ArrowUp aria-hidden />
              Move option up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={optionIndex === optionsCount - 1 || patchPending}
              onSelect={() => void onMoveOption(item, option, optionIndex, 1)}
            >
              <ArrowDown aria-hidden />
              Move option down
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void onRemoveOption(item, option)}
            >
              <Trash2 aria-hidden />
              Delete option
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
