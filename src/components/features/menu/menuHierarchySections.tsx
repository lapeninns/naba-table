'use client';

import { ArrowDown, ArrowUp, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOpsReorderMenuChildren } from '@/hooks/ops/useOpsMenuHierarchy';

import { primaryLabel } from './menuHierarchyDomain';
import {
  DEFAULT_MENU_ITEM_FILTER,
  isMenuItemFilterActive,
  menuItemMatchesFilter,
  type MenuItemFilter,
} from './menuHierarchyItemDomain';
import { ItemTable } from './menuHierarchyItemsTable';
import { movedIds } from './menuHierarchyOrder';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const SECTION_ACTION_BUTTON_CLASS = '[@media(pointer:coarse)]:min-h-11';
const SECTION_ICON_BUTTON_CLASS = 'size-9 [@media(pointer:coarse)]:size-11';

export function MenuSectionList({
  menu,
  gbpDriftFields,
  restaurantId,
  filter = DEFAULT_MENU_ITEM_FILTER,
  onCreateSection,
  onCreateItem,
  onEditSection,
  onDeleteSection,
  onEditItem,
  onDeleteItem,
  onCreateOption,
}: {
  menu: CanonicalRestaurantMenu;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  restaurantId: string;
  filter?: MenuItemFilter;
  onCreateSection: () => void;
  onCreateItem: (section: CanonicalRestaurantMenuSection) => void;
  onEditSection: (section: CanonicalRestaurantMenuSection) => void;
  onDeleteSection: (section: CanonicalRestaurantMenuSection) => void;
  onEditItem: (section: CanonicalRestaurantMenuSection, item: CanonicalRestaurantMenuItem) => void;
  onDeleteItem: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
  ) => void;
  onCreateOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
  ) => void;
}) {
  const reorder = useOpsReorderMenuChildren(restaurantId);
  const movePending = reorder.isPending;
  const filterActive = isMenuItemFilterActive(filter);

  // One reorder command: the new order shows at once and rolls back if the save fails
  // (the hook's meta feedback reports the failure).
  const moveSection = (index: number, direction: -1 | 1) => {
    const orderedIds = movedIds(menu.sections, index, direction);
    if (!menu.id || !orderedIds) return;
    reorder.mutate({ target: { level: 'sections', menuId: menu.id }, orderedIds });
  };

  if (menu.sections.length === 0) {
    return (
      <div className="border-t border-border/60 p-6">
        <OpsEmptyState
          title="No sections yet"
          description="Add a section, such as Starters, before adding items."
          action={
            <Button type="button" onClick={onCreateSection}>
              <Plus data-icon="inline-start" aria-hidden />
              Add section
            </Button>
          }
        />
      </div>
    );
  }

  const sections = menu.sections
    .map((section, index) => ({
      section,
      index,
      visibleItems: filterActive
        ? section.items.filter((item) => menuItemMatchesFilter(item, filter))
        : section.items,
    }))
    .filter(
      ({ section, visibleItems }) =>
        Boolean(section.id) && (!filterActive || visibleItems.length > 0),
    );

  if (sections.length === 0) {
    return (
      <div className="border-t border-border/60 p-6">
        <OpsEmptyState title="No items match" description="Try another search or filter." />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {sections.map(({ section, index, visibleItems }) => {
        const sectionName = primaryLabel(section, 'Section');
        const headingId = `menu-section-heading-${section.id}`;
        return (
          <section
            key={section.id}
            aria-labelledby={headingId}
            data-testid={`menu-section-${section.id}`}
            className="border-t border-border/60 first:border-t-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3 sm:px-5">
              <h3
                id={headingId}
                className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-foreground"
              >
                <span className="min-w-0 break-words">{sectionName}</span>
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                </span>
                {section.active ? null : (
                  <Badge variant="outline" className="gap-1">
                    <EyeOff className="size-3" aria-hidden />
                    Hidden
                  </Badge>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={SECTION_ICON_BUTTON_CLASS}
                  disabled={index === 0 || movePending}
                  aria-label={`Move ${sectionName} up`}
                  onClick={() => moveSection(index, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={SECTION_ICON_BUTTON_CLASS}
                  disabled={index === menu.sections.length - 1 || movePending}
                  aria-label={`Move ${sectionName} down`}
                  onClick={() => moveSection(index, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={SECTION_ACTION_BUTTON_CLASS}
                  aria-label={`Edit ${sectionName}`}
                  onClick={() => onEditSection(section)}
                >
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={SECTION_ACTION_BUTTON_CLASS}
                  aria-label={`Add item to ${sectionName}`}
                  onClick={() => onCreateItem(section)}
                >
                  <Plus data-icon="inline-start" aria-hidden />
                  Add item
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={SECTION_ICON_BUTTON_CLASS}
                      aria-label={`Open section actions for ${sectionName}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDeleteSection(section)}
                      >
                        <Trash2 aria-hidden />
                        Delete section
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <ItemTable
              restaurantId={restaurantId}
              menu={menu}
              section={section}
              visibleItems={visibleItems}
              filterActive={filterActive}
              gbpDriftFields={gbpDriftFields}
              onEditItem={(item) => onEditItem(section, item)}
              onDeleteItem={(item) => onDeleteItem(section, item)}
              onCreateOption={(item) => onCreateOption(section, item)}
            />
          </section>
        );
      })}
    </div>
  );
}
