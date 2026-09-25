'use client';

import { CheckCircle2, EyeOff, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Heading } from '@/components/ui/typography';

import { primaryDescription, primaryLabel } from './menuHierarchyDomain';
import { itemNeedsAttention } from './menuHierarchyItemDomain';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Counts shown under the menu name: "3 sections · 8 items · 2 need attention". */
export function menuSummaryLine(menu: CanonicalRestaurantMenu) {
  const items = menu.sections.flatMap((section) => section.items);
  const needAttention = items.filter(itemNeedsAttention).length;
  const parts = [plural(menu.sections.length, 'section'), plural(items.length, 'item')];
  if (needAttention > 0) parts.push(`${needAttention} need attention`);
  return parts.join(' · ');
}

export function SelectedMenuHeader({
  onCreateSection,
  onDeleteMenu,
  onEditMenu,
  selectedMenu,
}: {
  readonly onCreateSection: () => void;
  readonly onDeleteMenu: () => void;
  readonly onEditMenu: () => void;
  readonly selectedMenu: CanonicalRestaurantMenu;
}) {
  const menuName = primaryLabel(selectedMenu, 'Menu');
  const description = primaryDescription(selectedMenu).trim();

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Heading variant="title" as="h2" className="min-w-0 break-words">
            {menuName}
          </Heading>
          {selectedMenu.active ? (
            <Badge variant="status-confirmed" className="gap-1">
              <CheckCircle2 className="size-3" aria-hidden />
              Shown to guests
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <EyeOff className="size-3" aria-hidden />
              Hidden
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {menuSummaryLine(selectedMenu)}
        </p>
        {description ? (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="[@media(pointer:coarse)]:min-h-11"
          onClick={onEditMenu}
        >
          <Settings2 data-icon="inline-start" aria-hidden />
          Menu settings
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="[@media(pointer:coarse)]:min-h-11"
          onClick={onCreateSection}
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add section
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 [@media(pointer:coarse)]:size-11"
              aria-label={`Open menu actions for ${menuName}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={onDeleteMenu}>
                <Trash2 aria-hidden />
                Delete menu
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
