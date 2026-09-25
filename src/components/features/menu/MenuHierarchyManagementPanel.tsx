'use client';

import { Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StaleBoundary } from '@/components/ui/stale-boundary';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';

import { MenuItemFilterToolbar } from './MenuFilterControls';
import { DeleteHierarchyDialog, type MenuHierarchyDeleteTarget } from './menuHierarchyDeleteDialog';
import { primaryLabel } from './menuHierarchyDomain';
import { ItemDialog } from './menuHierarchyItemDialog';
import {
  DEFAULT_MENU_ITEM_FILTER,
  isMenuItemFilterActive,
  menuItemMatchesFilter,
  type MenuItemFilter,
} from './menuHierarchyItemDomain';
import {
  EmptyMenuState,
  EmptyPreferredMenuState,
  MenuLoadErrorState,
  MenuLoadingState,
  SelectRestaurantMenuState,
} from './menuHierarchyManagementStates';
import { MenuDialog, SectionDialog } from './menuHierarchyMenuSectionDialogs';
import { OptionDialog } from './menuHierarchyOptionDialog';
import { MenuSectionList } from './menuHierarchySections';
import { SelectedMenuHeader } from './menuHierarchySelectedMenuHeader';

import type {
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
  MenuKind,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

type MenuHierarchyManagementPanelProps = {
  restaurantId: string | null;
  preferredMenuKind: Extract<MenuKind, 'food' | 'drinks'>;
  gbpDriftFields?: ReadonlyArray<DualSyncFieldSummary>;
  /** Food / drinks switch, shown at the start of the menu bar. */
  catalogueSwitch?: ReactNode;
  /** Google drift note, shown between the menu bar and the menu. */
  notice?: ReactNode;
};

export function MenuHierarchyManagementPanel({
  restaurantId,
  preferredMenuKind,
  gbpDriftFields = [],
  catalogueSwitch,
  notice,
}: MenuHierarchyManagementPanelProps) {
  const menuSelectId = useId();
  const hierarchyQuery = useOpsMenuHierarchy(restaurantId);
  const menus = useMemo(() => hierarchyQuery.data?.menus ?? [], [hierarchyQuery.data?.menus]);
  const catalogueMenus = useMemo(
    () => menus.filter((menu) => menu.menuKind === preferredMenuKind || menu.menuKind === 'mixed'),
    [menus, preferredMenuKind],
  );
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MenuItemFilter>(DEFAULT_MENU_ITEM_FILTER);
  const [menuDialogMode, setMenuDialogMode] = useState<'create' | 'edit' | null>(null);
  const [sectionDialogState, setSectionDialogState] = useState<{
    mode: 'create' | 'edit';
    section: CanonicalRestaurantMenuSection | null;
  } | null>(null);
  const [editingItem, setEditingItem] = useState<CanonicalRestaurantMenuItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [optionTarget, setOptionTarget] = useState<{
    item: CanonicalRestaurantMenuItem;
    option: CanonicalRestaurantMenuOption | null;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuHierarchyDeleteTarget | null>(null);

  const selectedMenu = useMemo(
    () => catalogueMenus.find((menu) => menu.id === selectedMenuId) ?? null,
    [catalogueMenus, selectedMenuId],
  );
  const selectedSection = useMemo(
    () => selectedMenu?.sections.find((section) => section.id === selectedSectionId) ?? null,
    [selectedMenu, selectedSectionId],
  );
  // The item dialog keeps the snapshot it opened with; its options list follows saved data.
  const liveEditingItem = useMemo(
    () =>
      editingItem?.id
        ? (selectedSection?.items.find((item) => item.id === editingItem.id) ?? editingItem)
        : editingItem,
    [editingItem, selectedSection],
  );

  useEffect(() => {
    if (catalogueMenus.length === 0) {
      setSelectedMenuId(null);
      return;
    }
    const selectedStillExists = catalogueMenus.some((menu) => menu.id === selectedMenuId);
    if (selectedStillExists) return;
    setSelectedMenuId(catalogueMenus[0]?.id ?? null);
  }, [catalogueMenus, selectedMenuId]);

  if (!restaurantId) {
    return <SelectRestaurantMenuState />;
  }

  const openCreateMenu = () => setMenuDialogMode('create');
  const filterActive = isMenuItemFilterActive(filter);
  const matchingItemCount = selectedMenu
    ? selectedMenu.sections
        .flatMap((section) => section.items)
        .filter((item) => menuItemMatchesFilter(item, filter)).length
    : 0;
  const optionCallbacks = {
    onCreateOption: (item: CanonicalRestaurantMenuItem) => setOptionTarget({ item, option: null }),
    onEditOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) =>
      setOptionTarget({ item, option }),
    onDeleteOption: (item: CanonicalRestaurantMenuItem, option: CanonicalRestaurantMenuOption) => {
      if (!selectedMenu || !selectedSection) return;
      setDeleteTarget({
        type: 'option',
        menu: selectedMenu,
        section: selectedSection,
        item,
        option,
      });
    },
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        {catalogueSwitch}
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          {selectedMenu && catalogueMenus.length > 1 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor={menuSelectId} className="text-sm font-medium text-foreground">
                Menu
              </Label>
              <Select
                value={selectedMenu.id ?? ''}
                onValueChange={(value) => setSelectedMenuId(value || null)}
              >
                <SelectTrigger
                  id={menuSelectId}
                  className="w-full min-w-48 sm:w-56 [@media(pointer:coarse)]:min-h-11"
                >
                  <SelectValue placeholder="Select menu" />
                </SelectTrigger>
                <SelectContent>
                  {catalogueMenus.map((menu) =>
                    menu.id ? (
                      <SelectItem key={menu.id} value={menu.id}>
                        {primaryLabel(menu, 'Menu')}
                        {menu.active ? '' : ' (hidden)'}
                      </SelectItem>
                    ) : null,
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="[@media(pointer:coarse)]:min-h-11"
            onClick={openCreateMenu}
          >
            <Plus data-icon="inline-start" aria-hidden />
            New menu
          </Button>
        </div>
      </div>

      {notice}

      {hierarchyQuery.isError ? (
        <MenuLoadErrorState
          error={hierarchyQuery.error}
          onRetry={() => void hierarchyQuery.refetch()}
        />
      ) : null}
      {!hierarchyQuery.isError && hierarchyQuery.isLoading ? <MenuLoadingState /> : null}
      {!hierarchyQuery.isError && !hierarchyQuery.isLoading && menus.length === 0 ? (
        <EmptyMenuState onCreateMenu={openCreateMenu} />
      ) : null}
      {!hierarchyQuery.isError &&
      !hierarchyQuery.isLoading &&
      menus.length > 0 &&
      catalogueMenus.length === 0 ? (
        <EmptyPreferredMenuState
          preferredMenuKind={preferredMenuKind}
          onCreateMenu={openCreateMenu}
        />
      ) : null}

      {!hierarchyQuery.isError && selectedMenu ? (
        <section
          aria-label={primaryLabel(selectedMenu, 'Menu')}
          data-testid="menu-card"
          className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card"
        >
          <SelectedMenuHeader
            selectedMenu={selectedMenu}
            onCreateSection={() => setSectionDialogState({ mode: 'create', section: null })}
            onDeleteMenu={() => setDeleteTarget({ type: 'menu', menu: selectedMenu })}
            onEditMenu={() => setMenuDialogMode('edit')}
          />
          {selectedMenu.sections.length > 0 ? (
            <div className="border-t border-border/60 px-4 py-3 sm:px-5">
              <MenuItemFilterToolbar filter={filter} onFilterChange={setFilter} />
              <p role="status" className="sr-only">
                {filterActive
                  ? `${matchingItemCount} ${matchingItemCount === 1 ? 'item matches' : 'items match'}`
                  : ''}
              </p>
            </div>
          ) : null}

          <StaleBoundary
            isStale={hierarchyQuery.isPlaceholderData && hierarchyQuery.isFetching}
            className="min-w-0"
          >
            <MenuSectionList
              menu={selectedMenu}
              gbpDriftFields={gbpDriftFields}
              restaurantId={restaurantId}
              filter={filter}
              onCreateSection={() => setSectionDialogState({ mode: 'create', section: null })}
              onCreateItem={(section) => {
                setSelectedSectionId(section.id ?? null);
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
              onEditSection={(section) => {
                setSelectedSectionId(section.id ?? null);
                setSectionDialogState({ mode: 'edit', section });
              }}
              onDeleteSection={(section) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'section', menu: selectedMenu, section });
              }}
              onEditItem={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setEditingItem(item);
                setItemDialogOpen(true);
              }}
              onDeleteItem={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'item', menu: selectedMenu, section, item });
              }}
              onCreateOption={(section, item) => {
                setSelectedSectionId(section.id ?? null);
                setOptionTarget({ item, option: null });
              }}
            />
          </StaleBoundary>
        </section>
      ) : null}

      <MenuDialog
        restaurantId={restaurantId}
        mode={menuDialogMode}
        menu={menuDialogMode === 'edit' ? selectedMenu : null}
        defaultMenuKind={preferredMenuKind}
        onOpenChange={(open) => {
          if (!open) setMenuDialogMode(null);
        }}
      />
      <SectionDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        mode={sectionDialogState?.mode ?? null}
        section={sectionDialogState?.section ?? null}
        onOpenChange={(open) => {
          if (!open) setSectionDialogState(null);
        }}
      />
      <ItemDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        section={selectedSection}
        item={editingItem}
        liveItem={liveEditingItem}
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        optionCallbacks={optionCallbacks}
      />
      <OptionDialog
        restaurantId={restaurantId}
        menu={selectedMenu}
        section={selectedSection}
        item={optionTarget?.item ?? null}
        option={optionTarget?.option ?? null}
        onOpenChange={(open) => {
          if (!open) setOptionTarget(null);
        }}
      />
      <DeleteHierarchyDialog
        restaurantId={restaurantId}
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
