'use client';

import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type OpsPageToolbarProps = {
  search?: ReactNode;
  filters?: ReactNode;
  sort?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
  children?: ReactNode;
  className?: string;
};

export function OpsPageToolbar({
  search,
  filters,
  sort,
  actions,
  sticky = true,
  children,
  className,
}: OpsPageToolbarProps) {
  return (
    <div
      className={cn(
        'backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none',
        sticky
          ? 'sticky top-0 z-10 -mx-4 bg-background/80 px-4 py-2.5 sm:-mx-6 sm:px-6 md:mx-0 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-3 md:shadow-sm'
          : 'rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {filters}
          {sort}
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {actions}
          {search}
        </div>
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
