'use client';

import { CheckCircle2, EyeOff, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { SettingsCard } from '@/components/features/restaurant-settings/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { primaryDescription, primaryLabel } from './menuHierarchyDomain';
import { itemNeedsAttention } from './menuHierarchyItemDomain';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

export function plural(count: number, noun: string) {
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

export function SelectedMenuCard({
  onCreateSection,
  onDeleteMenu,
  onEditMenu,
  selectedMenu,
  subheader,
  children,
}: {
  readonly onCreateSection: () => void;
  readonly onDeleteMenu: () => void;
  readonly onEditMenu: () => void;
  readonly selectedMenu: CanonicalRestaurantMenu;
  /** Strip between the header and the sections, e.g. the item search and filter. */
  readonly subheader?: ReactNode;
  readonly children?: ReactNode;
}) {
  const menuName = primaryLabel(selectedMenu, 'Menu');
  const description = primaryDescription(selectedMenu).trim();

  return (
    <SettingsCard
      region
      data-testid="menu-card"
      title={<span className="min-w-0 break-words">{menuName}</span>}
      badges={
        selectedMenu.active ? (
          <Badge variant="status-confirmed" className="gap-1">
            <CheckCircle2 className="size-3" aria-hidden />
            Shown to guests
          </Badge>
        ) : (
          <Badge variant="status-completed" className="gap-1">
            <EyeOff className="size-3" aria-hidden />
            Hidden
          </Badge>
        )
      }
      description={
        <div className="flex flex-col gap-1">
          <p className="tabular-nums">{menuSummaryLine(selectedMenu)}</p>
          {description ? <p className="text-pretty">{description}</p> : null}
        </div>
      }
      headerAction={
        <div className="flex flex-wrap items-center justify-end gap-2">
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
                className="size-9 min-h-0 min-w-0 [@media(pointer:coarse)]:size-11"
                aria-label={`Open menu actions for ${menuName}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={16}>
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onSelect={onDeleteMenu}>
                  <Trash2 aria-hidden />
                  Delete menu
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      subheader={subheader}
      contentClassName="p-0"
    >
      {children}
    </SettingsCard>
  );
}
