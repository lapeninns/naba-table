'use client';

import { Loader2, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useOpsCreateDrinkMenuItem,
  useOpsDrinkMenuItem,
  useOpsDrinkMenuList,
  useOpsUpdateDrinkMenuItem,
} from '@/hooks/ops/useOpsDrinksMenu';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

import { DrinkImportDialog } from './DrinkImportDialog';
import { DrinkItemSheet } from './DrinkItemSheet';
import { MENU_STATUS_FILTER_OPTIONS, MenuFilterField } from './MenuFilterControls';

import type { DrinkItemUpsertInput, DrinkListStatusFilter } from '@/server/drinks-menu/types';

const EMPTY_FACETS = {
  categories: [],
  subcategories: [],
  serviceTimes: [],
  drinkTypes: [],
};

export function DrinkMenuManagementPanel({ restaurantId }: { restaurantId: string | null }) {
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<DrinkListStatusFilter>('all');
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

  const listQuery = useOpsDrinkMenuList(restaurantId, filters);
  const detailQuery = useOpsDrinkMenuItem(restaurantId, selectedItemId);
  const createMutation = useOpsCreateDrinkMenuItem(restaurantId);
  const updateMutation = useOpsUpdateDrinkMenuItem(restaurantId, selectedItemId);

  const items = listQuery.data?.items ?? [];
  const facets = listQuery.data?.facets ?? EMPTY_FACETS;

  const handleSubmit = async (payload: DrinkItemUpsertInput) => {
    try {
      if (selectedItemId) {
        await updateMutation.mutateAsync(payload);
        toast.success('Drink item updated.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Drink item created.');
      }
      setSheetOpen(false);
      setSelectedItemId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save the drink item');
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
      title="Drinks catalogue"
      description="Manage beer, wine, cocktails, spirits, and alcohol-free options for this venue."
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import drinks CSV
          </Button>
          <Button type="button" onClick={() => openEditorForItem(null)}>
            <Plus className="mr-2 h-4 w-4" />
            New drink item
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr,1fr]">
        <MenuFilterField label="Search">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, category, subcategory, drink type"
          />
        </MenuFilterField>
        <MenuFilterField label="Category">
          <Input
            list="drink-filter-category-options"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            placeholder="All categories"
          />
        </MenuFilterField>
        <MenuFilterField label="Subcategory">
          <Input
            list="drink-filter-subcategory-options"
            value={subcategoryFilter}
            onChange={(event) => setSubcategoryFilter(event.target.value)}
            placeholder="All subcategories"
          />
        </MenuFilterField>
        <MenuFilterField label="Status">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as DrinkListStatusFilter)}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {MENU_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MenuFilterField>
      </div>

      {listQuery.isError ? (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to load drink items.
        </div>
      ) : listQuery.isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading drink items…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          No drink items match the current filters.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drink</TableHead>
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
                    <div className="font-medium text-foreground">{item.drinkName}</div>
                    <div className="text-xs text-muted-foreground">{item.externalDrinkId}</div>
                  </TableCell>
                  <TableCell>
                    <div>{item.category}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.subcategory ?? item.drinkType ?? 'No subcategory'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.currency} {item.basePrice.toFixed(2)}
                  </TableCell>
                  <TableCell>{item.serviceTime ?? 'Not set'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.availabilityStatus === 'available' ? 'default' : 'secondary'}
                    >
                      {item.availabilityStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.modifierGroupCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.active ? 'default' : 'secondary'}>
                        {item.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        {item.alcoholic ? 'Alcoholic' : 'Non-alcoholic'}
                      </Badge>
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

      <datalist id="drink-filter-category-options">
        {facets.categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <datalist id="drink-filter-subcategory-options">
        {facets.subcategories.map((subcategory) => (
          <option key={subcategory} value={subcategory} />
        ))}
      </datalist>

      <DrinkItemSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setSelectedItemId(null);
            setEditorDirty(false);
          }
        }}
        isExistingItem={Boolean(selectedItemId)}
        item={selectedItemId ? (detailQuery.data ?? null) : null}
        loadError={selectedItemId ? (detailQuery.error?.message ?? null) : null}
        isLoading={Boolean(selectedItemId) && detailQuery.isLoading}
        isSaving={createMutation.isPending || updateMutation.isPending}
        facets={facets}
        onDirtyChange={setEditorDirty}
        onSubmit={handleSubmit}
      />

      <DrinkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        restaurantId={restaurantId}
      />

      <ConfirmDialog
        open={pendingItemId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingItemId(null);
        }}
        title="Discard unsaved drink item changes?"
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
