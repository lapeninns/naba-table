'use client';

import { AlertTriangle } from 'lucide-react';

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

export type TableAssignmentConfirmDialogsProps = {
  confirmApplyOpen: boolean;
  onConfirmApplyOpenChange: (open: boolean) => void;
  selectedTableCount: number;
  partySize: number;
  warnings: string[];
  onConfirmApply: () => void;
  confirmUnassignOpen: boolean;
  onConfirmUnassignOpenChange: (open: boolean) => void;
  onConfirmUnassign: () => void;
};

export function TableAssignmentConfirmDialogs({
  confirmApplyOpen,
  confirmUnassignOpen,
  onConfirmApply,
  onConfirmApplyOpenChange,
  onConfirmUnassign,
  onConfirmUnassignOpenChange,
  partySize,
  selectedTableCount,
  warnings,
}: TableAssignmentConfirmDialogsProps) {
  return (
    <>
      <AlertDialog open={confirmApplyOpen} onOpenChange={onConfirmApplyOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm table assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign {selectedTableCount} table
              {selectedTableCount === 1 ? '' : 's'} for {partySize} covers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {warnings.length > 0 && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-primary" aria-hidden />
                Warnings
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmApply}
              className="bg-primary/10 hover:bg-primary/10"
            >
              Confirm assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnassignOpen} onOpenChange={onConfirmUnassignOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assigned tables?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unassign all current tables for this booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmUnassign}
              className="bg-destructive/10 hover:bg-destructive/10"
            >
              Remove tables
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TableAssignmentConfirmDialogs;
