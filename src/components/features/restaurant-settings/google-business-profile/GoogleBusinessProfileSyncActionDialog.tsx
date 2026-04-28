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

import type { GoogleBusinessProfilePublishDirectionIntent } from '@/services/ops/restaurants';

export type GoogleBusinessProfileSyncActionItem = {
  id: string;
  label: string;
  description?: string;
  details?: string[];
  group?: string;
  supportLabel?: string;
  disabled?: boolean;
  defaultChecked?: boolean;
};

type GoogleBusinessProfileSyncActionPreflight = {
  publishJobId: string;
  idempotencyKey: string;
  directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  googleUpdateMasks: string[];
  warnings: Array<{ message: string }>;
  errors: Array<{ message: string }>;
  canPushToGoogle: boolean;
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
  /**
   * Items to display. By default they render as a read-only summary (the
   * selection lives in Step 1 of the parent workflow). Pass
   * `selectionEditable` to opt into the legacy editable-checkbox UX for
   * surfaces that still own selection at confirm-time (e.g. service-period
   * import/export dialogs).
   */
  items?: GoogleBusinessProfileSyncActionItem[];
  /**
   * When true, items render with editable checkboxes and `selectedIds` in
   * callbacks reflects the user choice. When false (default), items render
   * read-only and callbacks always include the full item id list.
   */
  selectionEditable?: boolean;
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  preflight?: GoogleBusinessProfileSyncActionPreflight | null;
  preflightLabel?: string;
  isPreflightPending?: boolean;
  preflightErrorMessage?: string | null;
  onPreflight?: (params: {
    selectedIds: string[];
    directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  }) => void | Promise<void>;
  onPreflightReset?: () => void;
  onConfirm: (params: {
    password: string;
    selectedIds: string[];
    directionIntent: GoogleBusinessProfilePublishDirectionIntent;
  }) => void | Promise<void>;
};

function buildInitialSelection(items: GoogleBusinessProfileSyncActionItem[]) {
  const explicitDefaults = items
    .filter((item) => item.defaultChecked && !item.disabled)
    .map((item) => item.id);
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
  selectionLabel,
  items = [],
  selectionEditable = false,
  directionIntent = 'google_to_nabatable',
  preflight = null,
  preflightLabel = 'Preflight publish',
  isPreflightPending = false,
  preflightErrorMessage,
  onPreflight,
  onPreflightReset,
  onConfirm,
}: GoogleBusinessProfileSyncActionDialogProps) {
  const [password, setPassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setSelectedIds(
      selectionEditable
        ? buildInitialSelection(items)
        : items.filter((item) => !item.disabled).map((item) => item.id),
    );
  }, [items, open, selectionEditable]);

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

  const selectableItems = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hasItems = items.length > 0;
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selectedIdSet.has(item.id));
  const requiresPreflight = Boolean(onPreflight);
  const preflightComplete = !requiresPreflight || Boolean(preflight);
  const resolvedSelectionLabel =
    selectionLabel ??
    (selectionEditable
      ? 'Choose the items to include in this action.'
      : 'These items were approved in Step 1 and will publish.');

  const resetPreflight = () => {
    onPreflightReset?.();
  };

  const toggleItem = (itemId: string, checked: boolean) => {
    resetPreflight();
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
      directionIntent,
    });
  };

  const handlePreflight = () => {
    void onPreflight?.({ selectedIds, directionIntent });
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
            <div
              className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4"
              data-testid="gbp-publish-summary"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {selectionEditable ? 'Selection' : 'Will publish'}
                  </p>
                  <p className="text-xs text-muted-foreground">{resolvedSelectionLabel}</p>
                </div>
                {selectionEditable ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedIds.length}/{selectableItems.length} selected
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetPreflight();
                        setSelectedIds(selectableItems.map((item) => item.id));
                      }}
                      disabled={selectableItems.length === 0 || allSelected || isPending}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetPreflight();
                        setSelectedIds([]);
                      }}
                      disabled={selectedIds.length === 0 || isPending}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary">{items.length} approved</Badge>
                )}
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
                        if (!selectionEditable) {
                          return (
                            <div
                              key={item.id}
                              className="space-y-1 rounded-lg border border-border/60 bg-background/80 p-3"
                              data-testid="gbp-publish-summary-item"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{item.label}</p>
                                {item.supportLabel ? (
                                  <Badge variant="outline">{item.supportLabel}</Badge>
                                ) : null}
                              </div>
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
                          );
                        }
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
                              {item.supportLabel ? (
                                <Badge variant="outline">{item.supportLabel}</Badge>
                              ) : null}
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

          {requiresPreflight ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
	                  <p className="text-sm font-medium text-foreground">Preflight</p>
	                  <p className="text-xs text-muted-foreground">
	                    Confirm the approved Nabatable updates before entering a password.
	                  </p>
                </div>
                <Button
                  type="button"
                  variant={preflight ? 'outline' : 'default'}
                  onClick={handlePreflight}
                  disabled={
                    isPending ||
                    isPreflightPending ||
                    (selectionEditable && hasItems && selectedIds.length === 0)
                  }
                >
                  {isPreflightPending ? 'Checking...' : preflightLabel}
                </Button>
              </div>
	              {preflight ? (
	                <div className="space-y-2 text-xs text-muted-foreground">
	                  <div className="flex flex-wrap gap-2">
	                    <Badge variant="secondary">Google → Nabatable</Badge>
	                    <Badge variant="outline">No Google write</Badge>
	                  </div>
                  {preflight.warnings.map((warning) => (
                    <p key={warning.message}>{warning.message}</p>
                  ))}
                </div>
              ) : null}
              {preflightErrorMessage ? (
                <Alert variant="destructive">
                  <AlertTitle>Preflight failed</AlertTitle>
                  <AlertDescription>{preflightErrorMessage}</AlertDescription>
                </Alert>
              ) : null}
              {preflight?.errors.length ? (
                <Alert variant="destructive">
                  <AlertTitle>Preflight blocked</AlertTitle>
                  <AlertDescription>
                    {preflight.errors.map((error) => error.message).join(' ')}
                  </AlertDescription>
                </Alert>
              ) : null}
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
              disabled={isPending || !preflightComplete}
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
              !preflightComplete ||
              password.trim().length === 0 ||
              (selectionEditable && hasItems && selectedIds.length === 0)
            }
          >
            {isPending ? 'Confirming...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
