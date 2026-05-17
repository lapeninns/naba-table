'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type SidebarCollapsedRailToggleProps = {
  children: ReactNode;
  openLabel?: string;
  className?: string;
};

/**
 * Icon-rail header slot (ChatGPT-style): shows `children` (profile, logo, etc.) by default;
 * on hover, swaps to the open-sidebar control with tooltip.
 */
export function SidebarCollapsedRailToggle({
  children,
  openLabel = 'Open sidebar',
  className,
}: SidebarCollapsedRailToggleProps) {
  return (
    <div
      className={cn(
        'group/rail-toggle relative flex size-8 shrink-0 items-center justify-center',
        className,
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover/rail-toggle:pointer-events-none group-hover/rail-toggle:opacity-0">
        {children}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger
            className={cn(
              'absolute inset-0 z-10 size-8 opacity-0 pointer-events-none transition-opacity duration-150',
              'group-hover/rail-toggle:pointer-events-auto group-hover/rail-toggle:opacity-100',
            )}
            aria-label={openLabel}
          />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {openLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
