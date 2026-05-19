'use client';

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type SidebarCollapseTriggerProps = {
  className?: string;
  labels?: {
    expanded: string;
    collapsed: string;
  };
};

/**
 * Desktop sidebar collapse control (ChatGPT-style): lives in the sidebar chrome,
 * tooltip reflects open vs icon-rail state. Pair with a mobile-only trigger in the
 * main inset when the sidebar is an off-canvas sheet.
 */
export function SidebarCollapseTrigger({
  className,
  labels = { expanded: 'Close sidebar', collapsed: 'Open sidebar' },
}: SidebarCollapseTriggerProps) {
  const { state } = useSidebar();
  const label = state === 'expanded' ? labels.expanded : labels.collapsed;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger
          className={cn('hidden size-7 shrink-0 md:inline-flex', className)}
          aria-label={label}
        />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
