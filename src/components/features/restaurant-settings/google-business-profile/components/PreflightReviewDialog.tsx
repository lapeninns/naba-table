'use client';

import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  directionLabel,
  directionShortLabel,
  formatValuePreview,
  humanFieldLabel,
  itemActionLabel,
  type SyncPublishDirection,
} from '../lib/sync-review';

import type {
  GoogleBusinessProfileDraftPublishPreflight,
  GoogleBusinessProfileDraftItem,
} from '@/services/ops/restaurants';

type SelectedItem = GoogleBusinessProfileDraftItem & { sectionLabel: string };

type PreflightReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: SyncPublishDirection;
  selectedItems: SelectedItem[];
  preflight: GoogleBusinessProfileDraftPublishPreflight | null;
  preflightErrorMessage?: string | null;
  isPreflightPending?: boolean;
  onRunPreflight: () => Promise<void> | void;
  onContinue: () => void;
};

export function PreflightReviewDialog({
  open,
  onOpenChange,
  direction,
  selectedItems,
  preflight,
  preflightErrorMessage,
  isPreflightPending = false,
  onRunPreflight,
  onContinue,
}: PreflightReviewDialogProps) {
  const canContinue = Boolean(preflight?.canPublish);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden sm:max-w-3xl">
        <SheetHeader className="border-b">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>Final check</SheetTitle>
            <Badge variant="outline">{directionShortLabel(direction)}</Badge>
          </div>
          <SheetDescription>
            Review the selected fields for {directionLabel(direction).toLowerCase()} before you
            enter your password.
          </SheetDescription>
        </SheetHeader>

        <div className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="min-w-0 space-y-4">
            <div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Chosen fields</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedItems.length} field{selectedItems.length === 1 ? '' : 's'} ready for
                    this update path.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onRunPreflight()}
                  disabled={selectedItems.length === 0 || isPreflightPending}
                  data-testid="gbp-run-preflight-button"
                >
                  <RefreshCw
                    className={isPreflightPending ? 'mr-2 size-4 animate-spin' : 'mr-2 size-4'}
                  />
                  {isPreflightPending
                    ? 'Checking…'
                    : preflight
                      ? 'Run final check again'
                      : 'Run final check'}
                </Button>
              </div>

              {selectedItems.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-md border bg-background">
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Nabatable</TableHead>
                        <TableHead>Google</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItems.map((item) => (
                        <TableRow key={item.fieldKey}>
                          <TableCell className="font-medium">{humanFieldLabel(item)}</TableCell>
                          <TableCell>{itemActionLabel(item, direction)}</TableCell>
                          <TableCell>{item.sectionLabel}</TableCell>
                          <TableCell className="max-w-[220px] whitespace-pre-wrap break-words text-muted-foreground">
                            {formatValuePreview(item.currentValue)}
                          </TableCell>
                          <TableCell className="max-w-[220px] whitespace-pre-wrap break-words text-foreground">
                            {formatValuePreview(item.providerValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Choose at least one field for this update path before running the final check.
                </p>
              )}
            </div>

            {preflight ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Direction
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {directionShortLabel(preflight.directionIntent as SyncPublishDirection)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Google fields
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {preflight.googleUpdateMasks.length > 0
                        ? preflight.googleUpdateMasks.join(', ')
                        : 'No Google fields selected'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Ready to apply
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                      {preflight.canPublish ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-600" />
                      )}
                      {preflight.canPublish ? 'Ready to apply' : 'Blocked'}
                    </div>
                  </div>
                </div>

                {preflight.warnings.length > 0 ? (
                  <Alert>
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription className="space-y-1">
                      {preflight.warnings.map((warning) => (
                        <p key={`${warning.code}-${warning.fieldKey ?? warning.message}`}>
                          {warning.message}
                        </p>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {preflight.errors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTitle>Final check blocked</AlertTitle>
                    <AlertDescription className="space-y-1">
                      {preflight.errors.map((error) => (
                        <p key={`${error.code}-${error.fieldKey ?? error.message}`}>
                          {error.message}
                        </p>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : null}

                {preflight.directionIntent === 'nabatable_to_google' &&
                preflight.pullOnlyItems.length > 0 ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Nabatable-only changes</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      These chosen changes can update Nabatable but cannot be sent to Google from
                      here yet.
                    </p>
                    <div className="mt-3 space-y-2">
                      {preflight.pullOnlyItems.map((item) => (
                        <div
                          key={item.fieldKey}
                          className="rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <p className="font-medium text-foreground">{humanFieldLabel(item)}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {preflightErrorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>Final check failed</AlertTitle>
                <AlertDescription>{preflightErrorMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!canContinue} onClick={onContinue}>
            Continue to apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
