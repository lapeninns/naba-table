'use client';

import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOpsPatchRestaurantMenuSection } from '@/hooks/ops/useOpsMenuHierarchy';
import { cn } from '@/lib/utils';

import { primaryLabel } from './menuHierarchyDomain';
import { ItemTable } from './menuHierarchyItemsTable';

import type {
  CanonicalRestaurantMenu,
  CanonicalRestaurantMenuItem,
  CanonicalRestaurantMenuOption,
  CanonicalRestaurantMenuSection,
} from '@/server/menu-hierarchy/types';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export function SectionAccordionTable({
  menu,
  gbpDriftFields,
  selectedSectionId,
  restaurantId,
  onSelectSection,
  onCreateItem,
  onEditSection,
  onDeleteSection,
  onEditItem,
  onDeleteItem,
  onCreateOption,
  onEditOption,
  onDeleteOption,
}: {
  menu: CanonicalRestaurantMenu;
  gbpDriftFields: ReadonlyArray<DualSyncFieldSummary>;
  selectedSectionId: string | null;
  restaurantId: string;
  onSelectSection: (sectionId: string | null) => void;
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
  onEditOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
  onDeleteOption: (
    section: CanonicalRestaurantMenuSection,
    item: CanonicalRestaurantMenuItem,
    option: CanonicalRestaurantMenuOption,
  ) => void;
}) {
  const patchSection = useOpsPatchRestaurantMenuSection(restaurantId);

  const moveSection = async (index: number, direction: -1 | 1) => {
    const current = menu.sections[index];
    const target = menu.sections[index + direction];
    if (!current?.id || !target?.id || !menu.id) return;
    await Promise.all([
      patchSection.mutateAsync({
        menuId: menu.id,
        sectionId: current.id,
        payload: { displayOrder: target.displayOrder },
      }),
      patchSection.mutateAsync({
        menuId: menu.id,
        sectionId: target.id,
        payload: { displayOrder: current.displayOrder },
      }),
    ]);
  };

  const renderItemTable = (section: CanonicalRestaurantMenuSection) => (
    <ItemTable
      restaurantId={restaurantId}
      menu={menu}
      section={section}
      gbpDriftFields={gbpDriftFields}
      onCreateItem={() => onCreateItem(section)}
      onEditItem={(item) => onEditItem(section, item)}
      onDeleteItem={(item) => onDeleteItem(section, item)}
      onCreateOption={(item) => onCreateOption(section, item)}
      onEditOption={(item, option) => onEditOption(section, item, option)}
      onDeleteOption={(item, option) => onDeleteOption(section, item, option)}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {menu.sections.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-6">
            <OpsEmptyState
              title="No sections yet"
              description="Add a section before creating items."
            />
          </CardContent>
        </Card>
      ) : null}
      {menu.sections.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          value={selectedSectionId ?? ''}
          onValueChange={(value) => onSelectSection(value || null)}
          className="flex flex-col gap-4"
        >
          {menu.sections.map((section, index) => {
            if (!section.id) {
              return null;
            }
            const sectionId = section.id;
            const selected = section.id === selectedSectionId;
            return (
              <AccordionItem
                key={sectionId}
                value={sectionId}
                className={cn(
                  'overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm transition-[border-color,box-shadow]',
                  selected && 'border-primary/30 shadow-md shadow-primary/5',
                )}
              >
                <div className="flex items-center gap-2 px-3 py-3">
                  <AccordionTrigger className="min-w-0 flex-1 rounded-md px-2 py-2 hover:bg-muted/60 hover:no-underline">
                    <span className="flex min-w-0 items-center gap-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xl font-semibold leading-tight text-foreground">
                          {primaryLabel(section, 'Section')}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="tabular-nums">
                            {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                          </span>
                          {section.active ? null : (
                            <Badge variant="outline" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-9"
                      disabled={index === 0 || patchSection.isPending}
                      aria-label="Move section up"
                      onClick={() => void moveSection(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10 md:size-9"
                      disabled={index === menu.sections.length - 1 || patchSection.isPending}
                      aria-label="Move section down"
                      onClick={() => void moveSection(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10 md:size-9"
                          aria-label={`Open section actions for ${primaryLabel(section, 'Section')}`}
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => onEditSection(section)}>
                            <Pencil aria-hidden />
                            Edit section
                          </DropdownMenuItem>
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
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-10 text-primary"
                      onClick={() => onCreateItem(section)}
                    >
                      <Plus data-icon="inline-start" aria-hidden />
                      Add item
                    </Button>
                  </div>
                </div>
                <AccordionContent className="border-t border-border/60 bg-muted/15 px-0 pb-0">
                  {renderItemTable(section)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : null}
    </div>
  );
}
