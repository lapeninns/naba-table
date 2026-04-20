'use client';

import { Loader2, Plus, Upload } from 'lucide-react';
import { cloneElement, isValidElement, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';
import { SettingsCard } from '@/components/features/restaurant-settings/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOpsCreateMenuItem, useOpsMenuItem, useOpsMenuList, useOpsUpdateMenuItem } from '@/hooks/ops/useOpsMenu';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { MenuImportDialog } from './MenuImportDialog';
import { MenuItemSheet } from './MenuItemSheet';

import type { MenuItemUpsertInput, MenuListStatusFilter } from '@/server/menu/types';
import type { ReactElement, ReactNode } from 'react';

const EMPTY_FACETS = {
  categories: [],
  subcategories: [],
  serviceTimes: [],
};

export function FoodMenuManagementPanel({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<MenuListStatusFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<{ value: string | null } | null>(null);

  const debouncedSearch = useDebouncedValue(searchInput, 250);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || null,
      category: categoryFilter || null,
      subcategory: subcategoryFilter || null,
      status: statusFilter,
    }),
    [categoryFilter, debouncedSearch, statusFilter, subcategoryFilter],
  );

  const listQuery = useOpsMenuList(restaurantId, filters);
  const detailQuery = useOpsMenuItem(restaurantId, selectedItemId);
  const createMutation = useOpsCreateMenuItem(restaurantId);
  const updateMutation = useOpsUpdateMenuItem(restaurantId, selectedItemId);

  const items = listQuery.data?.items ?? [];
  const facets = listQuery.data?.facets ?? EMPTY_FACETS;

  const handleSubmit = async (payload: MenuItemUpsertInput) => {
    try {
      if (selectedItemId) {
        await updateMutation.mutateAsync(payload);
        toast.success('Food item updated.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Food item created.');
      }
      setSheetOpen(false);
      setSelectedItemId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the food item');
      throw error;
    }
  };

  const openEditorForItem = (itemId: string | null) => {
    if (editorDirty && sheetOpen) {
      setPendingItemId({ value: itemId });
      return;
    }
    setSelectedItemId(itemId);
    setSheetOpen(true);
  };

  return (
    <SettingsCard
      title="Food catalogue"
      description="Search, filter, and edit food items currently attached to this restaurant."
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import food CSV
          </Button>
          <Button type="button" onClick={() => openEditorForItem(null)}>
            <Plus className="mr-2 h-4 w-4" />
            New food item
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr,1fr]">
        <Field label="Search">
          <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, category, subcategory" />
        </Field>
        <Field label="Category">
          <Input
            list="menu-filter-category-options"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            placeholder="All categories"
          />
        </Field>
        <Field label="Subcategory">
          <Input
            list="menu-filter-subcategory-options"
            value={subcategoryFilter}
            onChange={(event) => setSubcategoryFilter(event.target.value)}
            placeholder="All subcategories"
          />
        </Field>
        <Field label="Status">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as MenuListStatusFilter)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="sold-out">Sold out</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="unavailable">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {listQuery.isError ? (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load food items.
        </div>
      ) : listQuery.isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading food items…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          No food items match the current filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Service time</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Modifiers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{item.itemName}</div>
                    <div className="text-xs text-muted-foreground">{item.externalItemId}</div>
                  </TableCell>
                  <TableCell>
                    <div>{item.category}</div>
                    <div className="text-xs text-muted-foreground">{item.subcategory ?? 'No subcategory'}</div>
                  </TableCell>
                  <TableCell>
                    {item.currency} {item.basePrice.toFixed(2)}
                  </TableCell>
                  <TableCell>{item.serviceTime ?? 'Not set'}</TableCell>
                  <TableCell>
                    <Badge variant={item.availabilityStatus === 'available' ? 'default' : 'secondary'}>
                      {item.availabilityStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.modifierGroupCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.active ? 'default' : 'secondary'}>{item.active ? 'Active' : 'Inactive'}</Badge>
                      {item.soldOut ? <Badge variant="outline">Sold out</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditorForItem(item.id)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <datalist id="menu-filter-category-options">
        {facets.categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <datalist id="menu-filter-subcategory-options">
        {facets.subcategories.map((subcategory) => (
          <option key={subcategory} value={subcategory} />
        ))}
      </datalist>

      <MenuItemSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setSelectedItemId(null);
            setEditorDirty(false);
          }
        }}
        item={selectedItemId ? detailQuery.data ?? null : null}
        isLoading={Boolean(selectedItemId) && detailQuery.isLoading}
        isSaving={createMutation.isPending || updateMutation.isPending}
        facets={facets}
        onDirtyChange={setEditorDirty}
        onSubmit={handleSubmit}
      />

      <MenuImportDialog open={importOpen} onOpenChange={setImportOpen} restaurantId={restaurantId} />

      <ConfirmDialog
        open={pendingItemId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingItemId(null);
        }}
        title="Discard unsaved menu item changes?"
        description="Switching items will discard the edits currently open in the editor. This cannot be undone."
        confirmLabel="Discard and switch"
        cancelLabel="Keep editing"
        tone="destructive"
        onConfirm={() => {
          if (!pendingItemId) return;
          const nextId = pendingItemId.value;
          setPendingItemId(null);
          setEditorDirty(false);
          setSelectedItemId(nextId);
          setSheetOpen(true);
        }}
      />
    </SettingsCard>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const childElement = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const labelId = useId();
  const controlId = `${labelId}-control`;
  const controlName = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isGroupedContent = childElement && typeof childElement.type === 'string' && childElement.type === 'div';
  const labelledChild = childElement
    ? cloneElement(childElement, {
        id: isGroupedContent ? childElement.props.id : childElement.props.id ?? controlId,
        name: isGroupedContent ? childElement.props.name : childElement.props.name ?? controlName,
        'aria-labelledby': childElement.props['aria-labelledby'] ?? labelId,
      })
    : children;

  return (
    <div className="space-y-2">
      <label id={labelId} htmlFor={isGroupedContent ? undefined : controlId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {labelledChild}
    </div>
  );
}
