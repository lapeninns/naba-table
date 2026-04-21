'use client';

import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

export type GoogleBusinessProfileSyncActionItem = {
  id: string;
  label: string;
  description?: string;
  details?: string[];
  group?: string;
  disabled?: boolean;
  defaultChecked?: boolean;
};

type GoogleBusinessProfileSyncActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  errorMessage?: string | null;
  passwordLabel?: string;
  passwordDescription?: string;
  selectionLabel?: string;
  items?: GoogleBusinessProfileSyncActionItem[];
  onConfirm: (params: { password: string; selectedIds: string[] }) => void | Promise<void>;
};

function buildInitialSelection(items: GoogleBusinessProfileSyncActionItem[]) {
  const explicitDefaults = items.filter((item) => item.defaultChecked && !item.disabled).map((item) => item.id);
  if (explicitDefaults.length > 0) {
    return explicitDefaults;
  }

  return items.filter((item) => !item.disabled).map((item) => item.id);
}

export function GoogleBusinessProfileSyncActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  isPending = false,
  errorMessage,
  passwordLabel = 'Confirm with your login password',
  passwordDescription = 'This extra confirmation prevents accidental GBP changes and records that you approved the pending sync.',
  selectionLabel = 'Choose the items to include in this action.',
  items = [],
  onConfirm,
}: GoogleBusinessProfileSyncActionDialogProps) {
  const [password, setPassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPassword('');
    setSelectedIds(buildInitialSelection(items));
  }, [items, open]);

  const selectableItems = useMemo(
    () => items.filter((item) => !item.disabled),
    [items],
  );
  const groupedItems = useMemo(() => {
    const groups = new Map<string, GoogleBusinessProfileSyncActionItem[]>();
    for (const item of items) {
      const group = item.group ?? 'Items';
      const current = groups.get(group) ?? [];
      current.push(item);
      groups.set(group, current);
    }
    return [...groups.entries()];
  }, [items]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasItems = items.length > 0;
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIdSet.has(item.id));

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return [...new Set([...current, itemId])];
      }
      return current.filter((id) => id !== itemId);
    });
  };

  const handleConfirm = () => {
    void onConfirm({
      password: password.trim(),
      selectedIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {hasItems ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Selection</p>
                  <p className="text-xs text-muted-foreground">{selectionLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedIds.length}/{selectableItems.length} selected
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds(selectableItems.map((item) => item.id))}
                    disabled={selectableItems.length === 0 || allSelected || isPending}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    disabled={selectedIds.length === 0 || isPending}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {groupedItems.map(([group, groupItems]) => (
                  <div key={group} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {group}
                    </p>
                    <div className="space-y-2">
                      {groupItems.map((item) => {
                        const checked = selectedIdSet.has(item.id);
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              'flex cursor-pointer gap-3 rounded-lg border border-border/60 bg-background/80 p-3',
                              item.disabled && 'cursor-not-allowed opacity-60',
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={item.disabled || isPending}
                              onCheckedChange={(value) => toggleItem(item.id, Boolean(value))}
                              aria-label={item.label}
                              className="mt-0.5"
                            />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">{item.label}</p>
                              {item.description ? (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              ) : null}
                              {item.details?.length ? (
                                <div className="space-y-1">
                                  {item.details.map((detail) => (
                                    <p key={detail} className="text-xs text-muted-foreground">
                                      {detail}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-border/70 bg-card/60 p-4">
            <Label htmlFor="gbp-sync-password" className="text-sm font-medium text-foreground">
              {passwordLabel}
            </Label>
            <p className="text-xs text-muted-foreground">{passwordDescription}</p>
            <Input
              id="gbp-sync-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              disabled={isPending}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Action could not be completed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isPending ||
              password.trim().length === 0 ||
              (hasItems && selectedIds.length === 0)
            }
          >
            {isPending ? 'Confirming...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
