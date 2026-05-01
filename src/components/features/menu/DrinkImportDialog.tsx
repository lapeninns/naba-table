'use client';

import { Loader2, Upload } from 'lucide-react';
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useOpsDrinkMenuImportApply,
  useOpsDrinkMenuImportPreview,
} from '@/hooks/ops/useOpsDrinksMenu';

import type { DrinkImportResult } from '@/server/drinks-menu/types';
import type { DrinkMenuImportPayload } from '@/services/ops/drinks-menu';

function buildPayload(
  itemsFile: File | null,
  modifierGroupsFile: File | null,
  modifierOptionsFile: File | null,
): DrinkMenuImportPayload | null {
  if (!itemsFile) {
    return null;
  }
  return {
    itemsFile,
    modifierGroupsFile,
    modifierOptionsFile,
  };
}

export function DrinkImportDialog({
  open,
  onOpenChange,
  restaurantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
}) {
  const previewMutation = useOpsDrinkMenuImportPreview(restaurantId);
  const applyMutation = useOpsDrinkMenuImportApply(restaurantId);

  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [modifierGroupsFile, setModifierGroupsFile] = useState<File | null>(null);
  const [modifierOptionsFile, setModifierOptionsFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DrinkImportResult | null>(null);

  const payload = useMemo(
    () => buildPayload(itemsFile, modifierGroupsFile, modifierOptionsFile),
    [itemsFile, modifierGroupsFile, modifierOptionsFile],
  );

  const isBusy = previewMutation.isPending || applyMutation.isPending;

  const handleFileChange = (setter: Dispatch<SetStateAction<File | null>>, file: File | null) => {
    setPreview(null);
    setter(file);
  };

  const resetState = () => {
    setItemsFile(null);
    setModifierGroupsFile(null);
    setModifierOptionsFile(null);
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!payload) {
      toast.error('Select at least the drinks CSV to preview the import.');
      return;
    }
    try {
      const result = await previewMutation.mutateAsync(payload);
      setPreview(result);
      if (result.canApply) {
        toast.success('Drink import preview is ready.');
      } else {
        toast.error('Fix the import issues before applying.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to preview drink import');
    }
  };

  const handleApply = async () => {
    if (!payload) {
      toast.error('Select at least the drinks CSV before applying.');
      return;
    }
    try {
      const result = await applyMutation.mutateAsync(payload);
      setPreview(result);
      toast.success('Drink import applied.');
      onOpenChange(false);
      resetState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to apply drink import');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetState();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import drink CSVs</DialogTitle>
          <DialogDescription>
            Upload the required drinks CSV and, if needed, the optional modifier group and modifier
            option CSVs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="drink-import-items">Drinks CSV</Label>
            <Input
              id="drink-import-items"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFileChange(setItemsFile, event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="drink-import-groups">Modifier groups CSV</Label>
              <Input
                id="drink-import-groups"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  handleFileChange(setModifierGroupsFile, event.target.files?.[0] ?? null)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drink-import-options">Modifier options CSV</Label>
              <Input
                id="drink-import-options"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) =>
                  handleFileChange(setModifierOptionsFile, event.target.files?.[0] ?? null)
                }
              />
            </div>
          </div>

          {preview ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Drink rows" value={preview.summary.itemRows} />
                <Metric label="Group rows" value={preview.summary.modifierGroupRows} />
                <Metric label="Option rows" value={preview.summary.modifierOptionRows} />
                <Metric label="Impacted drinks" value={preview.summary.impactedItemCount} />
                <Metric label="Drinks to create" value={preview.summary.itemsToCreate} />
                <Metric label="Drinks to update" value={preview.summary.itemsToUpdate} />
                <Metric label="Groups to create" value={preview.summary.modifierGroupsToCreate} />
                <Metric label="Groups to update" value={preview.summary.modifierGroupsToUpdate} />
                <Metric label="Options to create" value={preview.summary.modifierOptionsToCreate} />
                <Metric label="Options to update" value={preview.summary.modifierOptionsToUpdate} />
              </div>

              {preview.errors.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-foreground">Validation issues</div>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-destructive/30 bg-background p-3">
                    {preview.errors.map((error, index) => (
                      <div
                        key={`${error.file}-${error.row}-${error.column ?? 'none'}-${index}`}
                        className="text-sm text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {error.file} row {error.row}
                          {error.column ? ` (${error.column})` : ''}
                        </span>
                        : {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert className="mt-4">
                  <Upload className="h-4 w-4" />
                  <AlertTitle>Preview ready</AlertTitle>
                  <AlertDescription>
                    The uploaded drink files passed validation and can be applied safely.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={isBusy || !payload}
          >
            {previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Preview import
          </Button>
          <Button type="button" onClick={handleApply} disabled={isBusy || !preview?.canApply}>
            {applyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Apply import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
