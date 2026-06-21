'use client';

import {
  ArrowDown,
  ArrowUp,
  Bike,
  Image as ImageIcon,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Store,
  ShoppingBasket,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import {
  deriveItemHealth,
  moneyLabel,
  normalizedServiceLabel,
  primaryLabel,
} from './menuHierarchyDomain';

import type {
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
} from '@/server/menu-hierarchy/types';

export function availabilityBadges(item: CanonicalRestaurantMenuItem) {
  const policy = item.extensions?.availabilityPolicy as Record<string, unknown> | undefined;
  const servicePeriods = Array.isArray(policy?.servicePeriods)
    ? policy.servicePeriods.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const soldOut = policy?.soldOut === true;
  const orderable = policy?.orderable !== false;

  if (soldOut) {
    return [{ label: 'Sold out', variant: 'status-cancelled' as const, Icon: Store }];
  }
  if (!orderable) {
    return [{ label: 'Unavailable', variant: 'status-pending' as const, Icon: Store }];
  }
  if (servicePeriods.length === 0) {
    return [{ label: 'All services', variant: 'metric' as const, Icon: Store }];
  }
  return servicePeriods.slice(0, 3).map((period) => {
    const label = normalizedServiceLabel(period);
    const Icon = label === 'Delivery' ? Bike : label === 'Pickup' ? ShoppingBasket : Store;
    return { label, variant: 'metric' as const, Icon };
  });
}

export function ItemHealthBadge({ item }: { item: CanonicalRestaurantMenuItem }) {
  const { health, reasons } = deriveItemHealth(item);
  const variant =
    health === 'ready'
      ? 'status-confirmed'
      : health === 'incomplete'
        ? 'status-pending'
        : 'outline';
  const label =
    health === 'ready' ? 'Ready' : health === 'incomplete' ? 'Needs attention' : 'Inactive';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={variant}
            className="cursor-default"
            aria-label={`Status: ${label}. ${reasons.join('. ')}`}
          >
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ItemThumbnail({ item }: { item: CanonicalRestaurantMenuItem }) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground shadow-xs',
        item.media.localImageUrl && 'border-primary/20 bg-primary/10 text-primary',
      )}
      aria-hidden
    >
      <ImageIcon />
    </span>
  );
}

export function ItemActions({
  item,
  itemIndex,
  itemsCount,
  patchPending,
  onQuickEditItem,
  onEditItem,
  onMoveItem,
  onDeleteItem,
}: {
  item: CanonicalRestaurantMenuItem;
  itemIndex: number;
  itemsCount: number;
  patchPending: boolean;
  onQuickEditItem: (item: CanonicalRestaurantMenuItem) => void;
  onEditItem: (item: CanonicalRestaurantMenuItem) => void;
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
          className="size-10 shrink-0 text-muted-foreground"
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
          <DropdownMenuItem onSelect={() => onEditItem(item)}>
            <Pencil aria-hidden />
            Full edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex === 0 || patchPending}
            onSelect={() => void onMoveItem(item, itemIndex, -1)}
          >
            <ArrowUp aria-hidden />
            Move item up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={itemIndex === itemsCount - 1 || patchPending}
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
        className="min-h-8 min-w-0 justify-start gap-2 rounded-none px-2 text-left"
        onClick={() => onEditOption(item, option)}
        aria-label={`Edit option ${primaryLabel(option, 'Option')}`}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {primaryLabel(option, 'Option')}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{price}</span>
        {!option.active ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Inactive
          </Badge>
        ) : null}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-none border-l"
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
