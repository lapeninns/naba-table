'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export interface DualSyncToolbarTipProps {
  readonly enabledHint: string;
  readonly disabledHint: string;
  readonly disabled: boolean;
  readonly children: ReactNode;
}

/** Tooltip for toolbar controls; keeps hints visible even when the trigger is disabled. */
export function DualSyncToolbarTip({
  enabledHint,
  disabledHint,
  disabled,
  children,
}: DualSyncToolbarTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', disabled && 'cursor-not-allowed')}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-balance">
        {disabled ? disabledHint : enabledHint}
      </TooltipContent>
    </Tooltip>
  );
}
