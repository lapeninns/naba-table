'use client';

import { Beer, MoreHorizontal, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heading } from '@/components/ui/typography';

import { primaryDescription, primaryLabel } from './menuHierarchyDomain';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

export function SelectedMenuHeader({
  catalogueMenus,
  onCreateMenu,
  onCreateSection,
  onDeleteMenu,
  onEditMenu,
  onSelectMenu,
  selectedMenu,
}: {
  readonly catalogueMenus: ReadonlyArray<CanonicalRestaurantMenu>;
  readonly onCreateMenu: () => void;
  readonly onCreateSection: () => void;
  readonly onDeleteMenu: () => void;
  readonly onEditMenu: () => void;
  readonly onSelectMenu: (menuId: string | null) => void;
  readonly selectedMenu: CanonicalRestaurantMenu;
}) {
  const selectedMenuItemCount = selectedMenu.sections.reduce(
    (acc, section) => acc + section.items.length,
    0,
  );
  const SelectedMenuIcon =
    selectedMenu.menuKind === 'drinks'
      ? Beer
      : selectedMenu.menuKind === 'food'
        ? UtensilsCrossed
        : null;

  return (
    <div className="rounded-lg border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {SelectedMenuIcon ? (
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <SelectedMenuIcon aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading variant="title" as="h2" className="truncate">
                {primaryLabel(selectedMenu, 'Menu')}
              </Heading>
              <Badge variant={selectedMenu.active ? 'secondary' : 'outline'}>
                {selectedMenu.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {selectedMenu.sections.length}{' '}
                {selectedMenu.sections.length === 1 ? 'section' : 'sections'}
              </span>
              <span className="tabular-nums">
                {selectedMenuItemCount} {selectedMenuItemCount === 1 ? 'item' : 'items'}
              </span>
              {primaryDescription(selectedMenu) ? (
                <span className="min-w-0 text-pretty">{primaryDescription(selectedMenu)}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {catalogueMenus.length > 1 ? (
            <Select
              value={selectedMenu.id ?? ''}
              onValueChange={(value) => onSelectMenu(value || null)}
            >
              <SelectTrigger className="h-10 w-full min-w-44 sm:w-auto" aria-label="Select menu">
                <SelectValue placeholder="Select menu" />
              </SelectTrigger>
              <SelectContent>
                {catalogueMenus.map((menu) =>
                  menu.id ? (
                    <SelectItem key={menu.id} value={menu.id}>
                      {primaryLabel(menu, 'Menu')}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          ) : null}
          <Button type="button" variant="outline" onClick={onCreateMenu}>
            <Plus data-icon="inline-start" aria-hidden />
            Menu
          </Button>
          <Button type="button" variant="outline" onClick={onEditMenu}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit
          </Button>
          <Button type="button" onClick={onCreateSection}>
            <Plus data-icon="inline-start" aria-hidden />
            Section
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label={`Open menu actions for ${primaryLabel(selectedMenu, 'Menu')}`}
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
    </div>
  );
}
