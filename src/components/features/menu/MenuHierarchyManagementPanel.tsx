'use client';

import { useEffect, useMemo, useState } from 'react';

import { StaleBoundary } from '@/components/ui/stale-boundary';
import { useOpsMenuHierarchy } from '@/hooks/ops/useOpsMenuHierarchy';

import { DeleteHierarchyDialog, type MenuHierarchyDeleteTarget } from './menuHierarchyDeleteDialog';
import { ItemDialog } from './menuHierarchyItemDialog';
import {
  EmptyMenuState,
  EmptyPreferredMenuState,
  MenuLoadErrorState,
  MenuLoadingState,
  SelectRestaurantMenuState,
} from './menuHierarchyManagementStates';
import { MenuDialog, SectionDialog } from './menuHierarchyMenuSectionDialogs';
import { OptionDialog } from './menuHierarchyOptionDialog';
import { SectionAccordionTable } from './menuHierarchySections';
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
};

export function MenuHierarchyManagementPanel({
  restaurantId,
  preferredMenuKind,
  gbpDriftFields = [],
}: MenuHierarchyManagementPanelProps) {
  const hierarchyQuery = useOpsMenuHierarchy(restaurantId);
  const menus = useMemo(() => hierarchyQuery.data?.menus ?? [], [hierarchyQuery.data?.menus]);
  const catalogueMenus = useMemo(
    () => menus.filter((menu) => menu.menuKind === preferredMenuKind || menu.menuKind === 'mixed'),
    [menus, preferredMenuKind],
  );
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
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

  useEffect(() => {
    if (catalogueMenus.length === 0) {
      setSelectedMenuId(null);
      return;
    }
    const selectedStillExists = catalogueMenus.some((menu) => menu.id === selectedMenuId);
    if (selectedStillExists) return;
    setSelectedMenuId(catalogueMenus[0]?.id ?? null);
  }, [catalogueMenus, selectedMenuId]);

  useEffect(() => {
    if (!selectedMenu) {
      setSelectedSectionId(null);
      return;
    }
    const selectedStillExists = selectedMenu.sections.some(
      (section) => section.id === selectedSectionId,
    );
    if (selectedStillExists) return;
    setSelectedSectionId(selectedMenu.sections[0]?.id ?? null);
  }, [selectedMenu, selectedSectionId]);

  if (!restaurantId) {
    return <SelectRestaurantMenuState />;
  }

  if (hierarchyQuery.isError) {
    return (
      <MenuLoadErrorState
        errorMessage={hierarchyQuery.error.message}
        onRetry={() => void hierarchyQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {hierarchyQuery.isLoading ? <MenuLoadingState /> : null}
      {!hierarchyQuery.isLoading && menus.length === 0 ? (
        <EmptyMenuState onCreateMenu={() => setMenuDialogMode('create')} />
      ) : null}

      {!hierarchyQuery.isLoading && menus.length > 0 && catalogueMenus.length === 0 ? (
        <EmptyPreferredMenuState
          preferredMenuKind={preferredMenuKind}
          onCreateMenu={() => setMenuDialogMode('create')}
        />
      ) : null}

      {selectedMenu ? (
        <div className="flex flex-col gap-4">
          <SelectedMenuHeader
            catalogueMenus={catalogueMenus}
            selectedMenu={selectedMenu}
            onCreateMenu={() => setMenuDialogMode('create')}
            onCreateSection={() => setSectionDialogState({ mode: 'create', section: null })}
            onDeleteMenu={() => setDeleteTarget({ type: 'menu', menu: selectedMenu })}
            onEditMenu={() => setMenuDialogMode('edit')}
            onSelectMenu={setSelectedMenuId}
          />

          <StaleBoundary
            isStale={hierarchyQuery.isPlaceholderData && hierarchyQuery.isFetching}
            className="min-w-0"
          >
            <SectionAccordionTable
              menu={selectedMenu}
              gbpDriftFields={gbpDriftFields}
              selectedSectionId={selectedSectionId}
              restaurantId={restaurantId}
              onSelectSection={setSelectedSectionId}
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
              onEditOption={(section, item, option) => {
                setSelectedSectionId(section.id ?? null);
                setOptionTarget({ item, option });
              }}
              onDeleteOption={(section, item, option) => {
                setSelectedSectionId(section.id ?? null);
                setDeleteTarget({ type: 'option', menu: selectedMenu, section, item, option });
              }}
            />
          </StaleBoundary>
        </div>
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
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
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
