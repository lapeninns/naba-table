'use client';

import { Check, Loader2, LogIn, LogOut, MoreHorizontal } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { OpsBookingCardActionsViewModel } from './opsBookingCardActionPolicy';

export type OpsBookingCardActionsProps = {
  actions: OpsBookingCardActionsViewModel;
  onDetails?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onMarkNoShow?: (bookingId: string) => Promise<void>;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
};

export const OpsBookingCardActions = memo(function OpsBookingCardActions({
  actions,
  onDetails,
  onEdit,
  onCancel,
  onMarkNoShow,
  onCheckIn,
  onCheckOut,
}: OpsBookingCardActionsProps) {
  const [isNoShowOpen, setIsNoShowOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isNoShowPending = actions.noShowConfirmation.pending;
  const partySize = actions.noShowConfirmation.description.partySize;
  const primaryButton = actions.primary.kind === 'button' ? actions.primary : null;
  const primaryHandler =
    primaryButton?.id === 'check-out'
      ? onCheckOut
      : primaryButton?.id === 'check-in'
        ? onCheckIn
        : undefined;
  const disableMenuTrigger =
    (actions.details.disabled || !onDetails) &&
    actions.menuItems.every((item) => {
      if (item.id === 'edit') return item.disabled || !onEdit;
      if (item.id === 'no-show') return item.disabled || !onMarkNoShow;
      if (item.id === 'cancel') return item.disabled || !onCancel;
      return item.disabled;
    });

  useEffect(() => {
    setActionError(null);
  }, [actions.bookingId, primaryButton?.id]);

  const getActionErrorMessage = useCallback((error: unknown) => {
    return error instanceof Error && error.message.trim()
      ? error.message
      : 'Unable to update this booking. Try again.';
  }, []);

  const handlePrimaryAction = useCallback(async () => {
    if (!primaryButton || !primaryHandler) {
      return;
    }

    setActionError(null);
    try {
      await primaryHandler(actions.bookingId);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }, [actions.bookingId, getActionErrorMessage, primaryButton, primaryHandler]);

  const handleOpenNoShow = useCallback(() => {
    setActionError(null);
    setIsNoShowOpen(true);
  }, []);

  const handleConfirmNoShow = useCallback(async () => {
    if (!onMarkNoShow) {
      return;
    }

    setActionError(null);
    try {
      await onMarkNoShow(actions.bookingId);
      setIsNoShowOpen(false);
    } catch (error) {
      setActionError(getActionErrorMessage(error));
    }
  }, [actions.bookingId, getActionErrorMessage, onMarkNoShow]);

  return (
    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {/* ── Utility row: Details + overflow menu ──────────────────── */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-xs font-medium text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 hover:text-foreground sm:h-8"
            onClick={onDetails}
            disabled={actions.details.disabled || !onDetails}
          >
            {actions.details.label}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 hover:text-foreground sm:h-8 sm:w-8"
                aria-label="More actions"
                disabled={disableMenuTrigger}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Manage
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onEdit}
                disabled={actions.menuItems[0].disabled || !onEdit}
              >
                {actions.menuItems[0].label}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenNoShow}
                disabled={actions.menuItems[1].disabled || !onMarkNoShow}
                variant="destructive"
              >
                {actions.menuItems[1].label}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onCancel}
                disabled={actions.menuItems[2].disabled || !onCancel}
                variant="destructive"
              >
                {actions.menuItems[2].label}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Primary CTA ───────────────────────────────────────────── */}
        <div className="sm:ml-auto">
          {primaryButton ? (
            <Button
              size="sm"
              disabled={primaryButton.disabled || !primaryHandler}
              className={cn(
                'h-9 w-full px-6 font-semibold shadow-sm transition-[box-shadow,background-color] duration-150 ease-out motion-reduce:transition-none sm:w-auto sm:min-w-[140px]',
                primaryButton.id === 'check-out'
                  ? 'border border-success/30 bg-transparent text-success hover:bg-success/10'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              variant={primaryButton.id === 'check-out' ? 'outline' : 'default'}
              onClick={() => void handlePrimaryAction()}
            >
              {primaryButton.pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Updating…
                </>
              ) : primaryButton.id === 'check-out' ? (
                <>
                  <LogOut className="mr-2 size-4" aria-hidden /> Finish
                </>
              ) : (
                <>
                  <LogIn className="mr-2 size-4" aria-hidden /> Seat Guest
                </>
              )}
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 text-xs font-bold text-muted-foreground"
              role="status"
            >
              <Check className="size-4 text-primary" aria-hidden />
              {actions.primary.label}
            </div>
          )}
        </div>
      </div>
      {actionError ? (
        <Text variant="label" className="mt-2 text-destructive" role="alert">
          {actionError}
        </Text>
      ) : null}

      <AlertDialog open={isNoShowOpen} onOpenChange={setIsNoShowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actions.noShowConfirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;re about to mark{' '}
              <span className="font-semibold text-foreground">
                {actions.noShowConfirmation.description.customerLabel}
              </span>{' '}
              as a no-show for <span className="font-semibold text-foreground">{partySize}</span>{' '}
              cover{partySize === 1 ? '' : 's'} on{' '}
              <span className="font-semibold text-foreground">
                {actions.noShowConfirmation.description.dateLabel} ·{' '}
                {actions.noShowConfirmation.description.timeRangeLabel}
              </span>
              . You can undo this shortly after confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <Text variant="label" className="text-destructive" role="alert">
              {actionError}
            </Text>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.noShowConfirmation.disabled || isNoShowPending}>
              {actions.noShowConfirmation.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmNoShow();
              }}
              className="bg-destructive/10 text-destructive hover:bg-destructive/10"
              disabled={actions.noShowConfirmation.disabled || isNoShowPending || !onMarkNoShow}
            >
              {isNoShowPending ? 'Marking…' : actions.noShowConfirmation.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

OpsBookingCardActions.displayName = 'OpsBookingCardActions';
