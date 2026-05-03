'use client';

import { ArchiveX, Check, RefreshCw, Send, Settings, Slash, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsFoodMenus } from '@/hooks/ops/useOpsFoodMenus';
import { cn } from '@/lib/utils';

import type { FoodMenusImportReviewRecord } from '@/server/google-business-profile/food-menus-storage';

interface FoodMenusImportReviewPanelProps {
  readonly restaurantId: string;
}

type PatchEntry = {
  readonly label: string;
  readonly value: string;
};

type ReviewDecisionAction =
  | 'apply_to_nabatable'
  | 'create_new_item'
  | 'ignore_google_change'
  | 'apply_menu_metadata'
  | 'mark_inactive'
  | 'mark_sold_out'
  | 'delete_local';

type ReviewFilter = 'all' | 'food' | 'drink' | 'deletes' | 'settings';

type SelectedReviewDecisions = Record<string, ReviewDecisionAction>;

interface ReviewBulkSummary {
  readonly applyable: number;
  readonly ignorable: number;
  readonly selected: number;
}

const PATCH_LABELS: Record<string, string> = {
  itemName: 'Name',
  category: 'Category',
  subcategory: 'Subcategory',
  shortDescription: 'Description',
  basePrice: 'Price',
  currency: 'Currency',
  spiceLevel: 'Spice',
  preparationMethod: 'Prep',
  portionSize: 'Portion',
  keyIngredients: 'Ingredients',
  imageUrl: 'Image',
  servesNum: 'Serves',
  dietaryTags: 'Dietary',
  allergensContains: 'Allergens',
  externalItemId: 'External ID',
  menuLabel: 'Menu label',
  sourceUrl: 'Source URL',
  cuisines: 'Cuisines',
  languageCode: 'Language',
};

const NUTRITION_PATCH_LABELS: Record<string, string> = {
  caloriesKcal: 'kcal',
  proteinG: 'protein',
  fatG: 'fat',
  carbsG: 'carbs',
  sodiumMg: 'sodium',
  sugarG: 'sugar',
  fiberG: 'fiber',
  saturatedFatG: 'sat fat',
};

const EMPTY_ROWS: ReadonlyArray<FoodMenusImportReviewRecord> = [];

function patchEntries(value: unknown): PatchEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const record = value as Record<string, unknown>;
  const entries = Object.entries(PATCH_LABELS).flatMap(([key, label]) => {
    if (!(key in record)) return [];
    if (key === 'modifierGroups') return [];
    const raw = record[key];
    if (raw === null || raw === undefined) {
      return [{ label, value: 'Clear value' }];
    }
    if (Array.isArray(raw)) {
      return [
        { label, value: raw.filter((entry) => typeof entry === 'string').join(', ') || 'None' },
      ];
    }
    if (typeof raw === 'number') {
      const currency = typeof record.currency === 'string' ? record.currency.toUpperCase() : 'GBP';
      return [
        { label, value: key === 'basePrice' ? `${currency} ${raw.toFixed(2)}` : String(raw) },
      ];
    }
    if (typeof raw === 'string') {
      return [{ label, value: raw.trim() || 'Empty' }];
    }
    return [{ label, value: JSON.stringify(raw) }];
  });
  const nutrition = Object.entries(NUTRITION_PATCH_LABELS)
    .flatMap(([key, label]) => {
      const raw = record[key];
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return [];
      }
      const unit = key === 'caloriesKcal' ? '' : key === 'sodiumMg' ? 'mg' : 'g';
      return [`${label} ${raw}${unit}`];
    })
    .join(', ');
  return nutrition ? [...entries, { label: 'Nutrition', value: nutrition }] : entries;
}

function modifierGroupEntries(value: unknown): PatchEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const groups = (value as Record<string, unknown>).modifierGroups;
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups.flatMap((group) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      return [];
    }
    const record = group as Record<string, unknown>;
    const groupName = typeof record.groupName === 'string' ? record.groupName : 'Options';
    const options = Array.isArray(record.options)
      ? record.options
          .map((option) => {
            if (!option || typeof option !== 'object' || Array.isArray(option)) {
              return null;
            }
            const optionRecord = option as Record<string, unknown>;
            const optionName =
              typeof optionRecord.optionName === 'string' ? optionRecord.optionName : null;
            const priceDelta =
              typeof optionRecord.priceDelta === 'number' ? optionRecord.priceDelta : 0;
            return optionName ? `${optionName} (${priceDelta >= 0 ? '+' : ''}${priceDelta})` : null;
          })
          .filter((entry): entry is string => Boolean(entry))
      : [];
    return [{ label: groupName, value: options.join(', ') || 'No options' }];
  });
}

function reviewTitle(row: FoodMenusImportReviewRecord): string {
  return row.googleItemName ?? row.externalItemId ?? row.googlePath ?? 'Menu settings';
}

function matchBadge(row: FoodMenusImportReviewRecord) {
  if (row.matchStatus === 'matched') {
    return <Badge variant="secondary">{row.matchConfidence.replace(/_/g, ' ')}</Badge>;
  }
  if (row.matchStatus === 'missing_from_google') {
    return <Badge variant="destructive">Missing from Google</Badge>;
  }
  if (row.matchStatus === 'menu_metadata') {
    return <Badge variant="secondary">Menu settings</Badge>;
  }
  return <Badge variant="outline">Unmatched</Badge>;
}

function targetBadge(row: FoodMenusImportReviewRecord) {
  return <Badge variant="outline">{row.targetKind === 'drink' ? 'Drink' : 'Food'}</Badge>;
}

function canApplySuggestion(row: FoodMenusImportReviewRecord): boolean {
  return row.matchStatus === 'matched' && patchEntries(row.suggestedPatch).length > 0;
}

function canCreateSuggestion(row: FoodMenusImportReviewRecord): boolean {
  if (row.matchStatus !== 'unmatched' || !row.suggestedPatch) {
    return false;
  }
  const patch = row.suggestedPatch as Record<string, unknown>;
  return (
    typeof patch.externalItemId === 'string' &&
    patch.externalItemId.trim().length > 0 &&
    typeof patch.itemName === 'string' &&
    patch.itemName.trim().length > 0 &&
    typeof patch.category === 'string' &&
    patch.category.trim().length > 0 &&
    typeof patch.basePrice === 'number' &&
    Number.isFinite(patch.basePrice)
  );
}

function canRunPrimaryAction(row: FoodMenusImportReviewRecord): boolean {
  if (row.matchStatus === 'matched') return canApplySuggestion(row);
  if (row.matchStatus === 'unmatched') return canCreateSuggestion(row);
  if (row.matchStatus === 'menu_metadata') return patchEntries(row.suggestedPatch).length > 0;
  return false;
}

function primaryActionForRow(row: FoodMenusImportReviewRecord): ReviewDecisionAction {
  if (row.matchStatus === 'menu_metadata') return 'apply_menu_metadata';
  return row.matchStatus === 'matched' ? 'apply_to_nabatable' : 'create_new_item';
}

function actionLabel(action: ReviewDecisionAction): string {
  switch (action) {
    case 'apply_to_nabatable':
      return 'Apply selected';
    case 'create_new_item':
      return 'Create selected';
    case 'apply_menu_metadata':
      return 'Settings selected';
    case 'mark_inactive':
      return 'Inactive selected';
    case 'mark_sold_out':
      return 'Sold out selected';
    case 'delete_local':
      return 'Delete selected';
    default:
      return 'Ignore selected';
  }
}

function filterRows(
  rows: ReadonlyArray<FoodMenusImportReviewRecord>,
  filter: ReviewFilter,
): ReadonlyArray<FoodMenusImportReviewRecord> {
  switch (filter) {
    case 'food':
      return rows.filter((row) => row.targetKind === 'food' && row.matchStatus !== 'menu_metadata');
    case 'drink':
      return rows.filter((row) => row.targetKind === 'drink');
    case 'deletes':
      return rows.filter((row) => row.matchStatus === 'missing_from_google');
    case 'settings':
      return rows.filter((row) => row.matchStatus === 'menu_metadata');
    default:
      return rows;
  }
}

export function FoodMenusImportReviewPanel({ restaurantId }: FoodMenusImportReviewPanelProps) {
  const { importReviewsQuery, refreshImportReviewMutation, decideImportReviewMutation } =
    useOpsFoodMenus({ restaurantId });
  const [selectedDecisions, setSelectedDecisions] = useState<SelectedReviewDecisions>({});
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all');

  const rows = importReviewsQuery.data?.rows ?? EMPTY_ROWS;
  const visibleRows = useMemo(() => filterRows(rows, activeFilter), [rows, activeFilter]);
  const rowSignature = rows.map((row) => row.id).join('|');
  const isBusy = refreshImportReviewMutation.isPending || decideImportReviewMutation.isPending;
  const selectedCount = Object.keys(selectedDecisions).length;
  const canSubmit = selectedCount > 0 && !isBusy;

  const bulkSummary = useMemo<ReviewBulkSummary>(
    () =>
      visibleRows.reduce<ReviewBulkSummary>(
        (summary, row) => ({
          applyable:
            summary.applyable +
            (row.matchStatus !== 'menu_metadata' && canRunPrimaryAction(row) ? 1 : 0),
          ignorable: summary.ignorable + 1,
          selected: summary.selected + (selectedDecisions[row.id] ? 1 : 0),
        }),
        { applyable: 0, ignorable: 0, selected: 0 },
      ),
    [visibleRows, selectedDecisions],
  );

  useEffect(() => {
    setSelectedDecisions({});
  }, [restaurantId, rowSignature]);

  const onRefresh = async () => {
    try {
      const result = await refreshImportReviewMutation.mutateAsync({ persist: true });
      setSelectedDecisions({});
      const count = result.rows.length;
      if (count > 0) {
        toast.success(`${count} Google menu suggestion${count === 1 ? '' : 's'} ready to review.`);
      } else {
        toast.info('Google FoodMenus is in sync with the current review rules.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to refresh Google FoodMenus.');
    }
  };

  const onSelectDecision = (row: FoodMenusImportReviewRecord, action: ReviewDecisionAction) => {
    if (
      (action === 'apply_to_nabatable' || action === 'create_new_item') &&
      !canRunPrimaryAction(row)
    ) {
      return;
    }
    setSelectedDecisions((prev) => {
      const updated = { ...prev };
      if (updated[row.id] === action) {
        delete updated[row.id];
      } else {
        updated[row.id] = action;
      }
      return updated;
    });
  };

  const onBulkApplySafe = () => {
    setSelectedDecisions((prev) => {
      const updated = { ...prev };
      for (const row of visibleRows) {
        if (row.matchStatus !== 'menu_metadata' && canRunPrimaryAction(row)) {
          updated[row.id] = primaryActionForRow(row);
        }
      }
      return updated;
    });
  };

  const onBulkIgnoreAll = () => {
    setSelectedDecisions((prev) => {
      const updated = { ...prev };
      for (const row of visibleRows) {
        updated[row.id] = 'ignore_google_change';
      }
      return updated;
    });
  };

  const onClearSelected = () => {
    setSelectedDecisions({});
  };

  const onSubmitSelected = async () => {
    const selectedRows = rows
      .map((row) => ({ row, action: selectedDecisions[row.id] }))
      .filter(
        (entry): entry is { row: FoodMenusImportReviewRecord; action: ReviewDecisionAction } =>
          Boolean(entry.action),
      );
    if (selectedRows.length === 0) {
      return;
    }

    let applied = 0;
    let created = 0;
    let ignored = 0;
    let metadataApplied = 0;
    let deactivated = 0;
    let soldOut = 0;
    let deleted = 0;
    try {
      for (const { row, action } of selectedRows) {
        await decideImportReviewMutation.mutateAsync({ reviewId: row.id, action });
        if (action === 'apply_to_nabatable') {
          applied += 1;
        } else if (action === 'create_new_item') {
          created += 1;
        } else if (action === 'apply_menu_metadata') {
          metadataApplied += 1;
        } else if (action === 'mark_inactive') {
          deactivated += 1;
        } else if (action === 'mark_sold_out') {
          soldOut += 1;
        } else if (action === 'delete_local') {
          deleted += 1;
        } else {
          ignored += 1;
        }
      }
      setSelectedDecisions({});
      toast.success(
        [
          applied > 0 ? `${applied} applied` : null,
          created > 0 ? `${created} created` : null,
          metadataApplied > 0 ? `${metadataApplied} settings updated` : null,
          deactivated > 0 ? `${deactivated} marked inactive` : null,
          soldOut > 0 ? `${soldOut} marked sold out` : null,
          deleted > 0 ? `${deleted} deleted` : null,
          ignored > 0 ? `${ignored} ignored` : null,
        ]
          .filter(Boolean)
          .join(', '),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to update selected suggestions.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Review Google menu suggestions</p>
            <Badge variant={rows.length > 0 ? 'secondary' : 'outline'} className="tabular-nums">
              {rows.length} pending
            </Badge>
            {selectedCount > 0 ? (
              <Badge variant="outline" className="tabular-nums">
                {selectedCount} selected
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Select safe Google-origin menu changes, then apply or ignore them together.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isBusy}
          aria-disabled={isBusy}
        >
          <RefreshCw
            data-icon="inline-start"
            className={cn(refreshImportReviewMutation.isPending && 'animate-spin')}
          />
          Refresh Google menu
        </Button>
      </div>

      {importReviewsQuery.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : importReviewsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load menu suggestions</AlertTitle>
          <AlertDescription>
            {importReviewsQuery.error instanceof Error
              ? importReviewsQuery.error.message
              : 'Unknown error.'}
          </AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
        <Alert>
          <AlertTitle>No pending menu suggestions</AlertTitle>
          <AlertDescription>
            Refresh Google FoodMenus when you want to compare Google&apos;s current menu with
            Nabatable.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-3" role="list">
          <div className="flex flex-wrap gap-2" aria-label="Menu suggestion filters">
            {(
              [
                ['all', 'All'],
                ['food', 'Food'],
                ['drink', 'Drinks'],
                ['deletes', 'Deletes'],
                ['settings', 'Menu settings'],
              ] as const
            ).map(([filter, label]) => (
              <Button
                key={filter}
                type="button"
                variant={activeFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(filter)}
                disabled={isBusy}
                aria-disabled={isBusy}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide">Bulk select</p>
              <p className="text-muted-foreground text-xs">
                Apply only matched suggestions with safe patches; ignore can cover every pending
                row.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBulkApplySafe}
                disabled={isBusy || bulkSummary.applyable === 0}
                aria-disabled={isBusy || bulkSummary.applyable === 0}
              >
                Apply all safe ({bulkSummary.applyable})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBulkIgnoreAll}
                disabled={isBusy || bulkSummary.ignorable === 0}
                aria-disabled={isBusy || bulkSummary.ignorable === 0}
              >
                Ignore all ({bulkSummary.ignorable})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelected}
                disabled={isBusy || bulkSummary.selected === 0}
                aria-disabled={isBusy || bulkSummary.selected === 0}
              >
                Clear ({bulkSummary.selected})
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSubmitSelected}
                disabled={!canSubmit}
                aria-disabled={!canSubmit}
              >
                <Send data-icon="inline-start" />
                {decideImportReviewMutation.isPending
                  ? 'Applying…'
                  : `Apply selected ${selectedCount > 0 ? `(${selectedCount})` : ''}`.trim()}
              </Button>
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <Alert>
              <AlertTitle>No rows in this filter</AlertTitle>
              <AlertDescription>
                Choose another filter to review remaining suggestions.
              </AlertDescription>
            </Alert>
          ) : null}

          {visibleRows.map((row) => {
            const entries = patchEntries(row.suggestedPatch);
            const modifierEntries = modifierGroupEntries(row.suggestedPatch);
            const primaryAction = primaryActionForRow(row);
            const canRunPrimary = canRunPrimaryAction(row);
            const selectedAction = selectedDecisions[row.id] ?? null;
            return (
              <div
                key={row.id}
                role="listitem"
                className={cn(
                  'flex flex-col gap-3 rounded-md border border-border/60 bg-background p-3',
                  selectedAction && 'bg-muted/30',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{reviewTitle(row)}</p>
                      {targetBadge(row)}
                      {matchBadge(row)}
                      {selectedAction ? (
                        <Badge variant="outline">{actionLabel(selectedAction)}</Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {row.googleSectionLabel ?? 'No section'} · {row.googlePath ?? 'Local item'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={selectedAction === 'ignore_google_change' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onSelectDecision(row, 'ignore_google_change')}
                      disabled={isBusy}
                      aria-disabled={isBusy}
                    >
                      <Slash data-icon="inline-start" />
                      Ignore
                    </Button>
                    <Button
                      type="button"
                      variant={selectedAction === primaryAction ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onSelectDecision(row, primaryAction)}
                      disabled={!canRunPrimary || isBusy}
                      aria-disabled={!canRunPrimary || isBusy}
                      title={
                        canRunPrimary
                          ? 'Select this suggestion for the next batch.'
                          : row.matchStatus === 'matched'
                            ? 'Only matched suggestions with safe field patches can be applied.'
                            : 'Only Google items with a name, section, and price can be created.'
                      }
                    >
                      {row.matchStatus === 'menu_metadata' ? (
                        <Settings data-icon="inline-start" />
                      ) : (
                        <Check data-icon="inline-start" />
                      )}
                      {row.matchStatus === 'matched'
                        ? 'Apply'
                        : row.matchStatus === 'menu_metadata'
                          ? 'Apply settings'
                          : 'Create'}
                    </Button>
                    {row.matchStatus === 'missing_from_google' ? (
                      <>
                        <Button
                          type="button"
                          variant={selectedAction === 'mark_inactive' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSelectDecision(row, 'mark_inactive')}
                          disabled={isBusy}
                          aria-disabled={isBusy}
                        >
                          <ArchiveX data-icon="inline-start" />
                          Mark inactive
                        </Button>
                        <Button
                          type="button"
                          variant={selectedAction === 'mark_sold_out' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onSelectDecision(row, 'mark_sold_out')}
                          disabled={isBusy}
                          aria-disabled={isBusy}
                        >
                          Mark sold out
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant={selectedAction === 'delete_local' ? 'default' : 'outline'}
                              size="sm"
                              disabled={isBusy}
                              aria-disabled={isBusy}
                            >
                              <Trash2 data-icon="inline-start" />
                              Delete local
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this local item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This only selects the delete action for the batch. The item is not
                                deleted until you apply selected decisions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onSelectDecision(row, 'delete_local')}
                              >
                                Select delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : null}
                  </div>
                </div>

                <Separator />

                {entries.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entries.map((entry) => (
                      <Badge key={`${row.id}-${entry.label}`} variant="outline">
                        {entry.label}: {entry.value}
                        {entry.label === 'Image' && /^https?:\/\//i.test(entry.value) ? (
                          <Button
                            asChild
                            variant="link"
                            size="sm"
                            className="ml-1 h-auto p-0 text-xs"
                          >
                            <a href={entry.value} target="_blank" rel="noreferrer">
                              Preview
                            </a>
                          </Button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {row.matchStatus === 'matched'
                      ? 'No safe field patch is available for this Google item.'
                      : row.matchStatus === 'missing_from_google'
                        ? 'Choose whether this local item should be marked inactive, sold out, deleted, or ignored.'
                        : 'This Google item is missing the minimum fields needed to create an item.'}
                  </p>
                )}

                {modifierEntries.length > 0 ? (
                  <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-2">
                    <p className="text-xs font-semibold">Modifier groups</p>
                    {modifierEntries.map((entry) => (
                      <p key={`${row.id}-${entry.label}-modifiers`} className="text-xs">
                        {entry.label}: {entry.value}
                      </p>
                    ))}
                  </div>
                ) : null}

                {row.warnings.length > 0 ? (
                  <p className="text-muted-foreground text-xs">{row.warnings.join(' ')}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
