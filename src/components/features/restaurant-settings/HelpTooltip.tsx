'use client';

import { Info } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type HelpTooltipProps = {
  description: string;
  ariaLabel: string;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
};

export function HelpTooltip({
  description,
  ariaLabel,
  className,
  side = 'top',
  align = 'start',
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            className,
          )}
          aria-label={ariaLabel}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-xs text-xs leading-snug">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
