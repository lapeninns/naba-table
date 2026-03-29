'use client';

import {
  Check,
  LogIn,
  LogOut,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';

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
import { cn } from '@/lib/utils';

import type { OpsBookingCardActionsViewModel } from './opsBookingCardUtils';

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
  const isNoShowPending = actions.noShowConfirmation.pending;
  const partySize = actions.noShowConfirmation.description.partySize;
  const primaryButton = actions.primary.kind === 'button' ? actions.primary : null;

  const handleConfirmNoShow = useCallback(async () => {
    try {
      await onMarkNoShow?.(actions.bookingId);
    } finally {
      setIsNoShowOpen(false);
    }
  }, [actions.bookingId, onMarkNoShow]);

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-y-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-11 px-4 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring sm:h-8"
            onClick={onDetails}
            disabled={actions.details.disabled}
          >
            {actions.details.label}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Manage
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit} disabled={actions.menuItems[0].disabled}>
                {actions.menuItems[0].label}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsNoShowOpen(true)}
                disabled={actions.menuItems[1].disabled}
                variant="destructive"
              >
                {actions.menuItems[1].label}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onCancel}
                disabled={actions.menuItems[2].disabled}
                variant="destructive"
              >
                {actions.menuItems[2].label}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          {primaryButton ? (
            <Button
              size="sm"
              disabled={primaryButton.disabled}
              className={cn(
                'h-11 min-w-[120px] px-6 font-semibold text-white shadow-sm transition-[box-shadow,background-color] duration-150 ease-out hover:shadow-sm motion-reduce:transition-none sm:h-9',
                primaryButton.id === 'check-out'
                  ? 'bg-slate-700 hover:bg-slate-800'
                  : 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={() =>
                primaryButton.id === 'check-out'
                  ? onCheckOut?.(actions.bookingId)
                  : onCheckIn?.(actions.bookingId)
              }
            >
              {primaryButton.pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Updating…
                </>
              ) : primaryButton.id === 'check-out' ? (
                <>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden /> Finish
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" aria-hidden /> Seat Guest
                </>
              )}
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 text-xs font-bold text-slate-400"
              role="status"
            >
              <Check className="h-4 w-4 text-emerald-500" aria-hidden />
              {actions.primary.label}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={isNoShowOpen} onOpenChange={setIsNoShowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actions.noShowConfirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>
              You’re about to mark{' '}
              <span className="font-semibold text-foreground">
                {actions.noShowConfirmation.description.customerLabel}
              </span>{' '}
              as a no-show
              for <span className="font-semibold text-foreground">{partySize}</span>{' '}
              cover{partySize === 1 ? '' : 's'} on{' '}
              <span className="font-semibold text-foreground">
                {actions.noShowConfirmation.description.dateLabel} ·{' '}
                {actions.noShowConfirmation.description.timeRangeLabel}
              </span>
              . You can undo this shortly after confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actions.noShowConfirmation.disabled || isNoShowPending}>
              {actions.noShowConfirmation.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmNoShow()}
              className="bg-rose-600 hover:bg-rose-700"
              disabled={actions.noShowConfirmation.disabled || isNoShowPending}
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
