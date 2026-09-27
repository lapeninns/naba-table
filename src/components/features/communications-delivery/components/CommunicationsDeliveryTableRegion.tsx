'use client';

import { MoveHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type CommunicationsDeliveryTableRegionProps = {
  label: string;
  children: ReactNode;
  /** Show the "scroll sideways" hint below this breakpoint. */
  hintBelow?: 'md' | 'lg' | 'none';
  className?: string;
};

/**
 * Bordered region for a real table. The table primitive scrolls inside it, so the page never
 * scrolls sideways; on narrow widths a caption says the table scrolls.
 */
export function CommunicationsDeliveryTableRegion({
  label,
  children,
  hintBelow = 'md',
  className,
}: CommunicationsDeliveryTableRegionProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {hintBelow !== 'none' ? (
        <p
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            hintBelow === 'md' ? 'md:hidden' : 'lg:hidden',
          )}
        >
          <MoveHorizontal className="size-3.5" aria-hidden />
          Scroll sideways to see every column.
        </p>
      ) : null}
      <div
        role="region"
        aria-label={label}
        className="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
      >
        {children}
      </div>
    </div>
  );
}
