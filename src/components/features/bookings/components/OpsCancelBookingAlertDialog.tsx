'use client';

import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

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

export type OpsCancelBookingAlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string | null;
  partySize?: number | null;
  whenLabel?: string | null;
  onConfirm: () => Promise<void> | void;
  isPending: boolean;
};

export function OpsCancelBookingAlertDialog({
  open,
  onOpenChange,
  customerName,
  partySize,
  whenLabel,
  onConfirm,
  isPending,
}: OpsCancelBookingAlertDialogProps) {
  const description = useMemo(() => {
    if (!customerName && !partySize && !whenLabel) {
      return 'This action cannot be undone. The guest will be notified.';
    }

    const name = customerName ?? 'this booking';
    const covers = typeof partySize === 'number' ? `${partySize} covers` : 'covers';
    const when = whenLabel ? ` (${whenLabel})` : '';
    return `You’re about to cancel ${name} for ${covers}${when}. This action cannot be undone. The guest will be notified.`;
  }, [customerName, partySize, whenLabel]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void onConfirm()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Cancelling…
              </>
            ) : (
              'Confirm cancellation'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default OpsCancelBookingAlertDialog;
