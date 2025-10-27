'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type ManualAssignmentActionsProps = {
  onValidate: () => void;
  onConfirm: () => void;
  onClear: () => void;
  disableValidate: boolean;
  disableConfirm: boolean;
  disableClear: boolean;
  validating: boolean;
  confirming: boolean;
  confirmDisabledReason?: string | null;
};

export function ManualAssignmentActions({
  onValidate,
  onConfirm,
  onClear,
  disableValidate,
  disableConfirm,
  disableClear,
  validating,
  confirming,
  confirmDisabledReason,
}: ManualAssignmentActionsProps) {
  const confirmButton = (
    <Button
      size="sm"
      className="h-9 min-w-[6.5rem]"
      onClick={onConfirm}
      disabled={disableConfirm || confirming}
    >
      {confirming ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Assigning…
        </>
      ) : (
        'Confirm assignment'
      )}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={onValidate}
        disabled={disableValidate || validating}
      >
        {validating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Validating…
          </>
        ) : (
          'Validate selection'
        )}
      </Button>

      {confirmDisabledReason ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{confirmButton}</TooltipTrigger>
            <TooltipContent side="top" align="center" className="max-w-xs text-xs">
              {confirmDisabledReason}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        confirmButton
      )}

      <Button
        variant="ghost"
        size="sm"
        className="h-9"
        onClick={onClear}
        disabled={disableClear || confirming}
      >
        Clear selection
      </Button>
    </div>
  );
}
