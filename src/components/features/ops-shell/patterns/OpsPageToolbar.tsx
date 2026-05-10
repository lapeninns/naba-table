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
  const hasLeading = Boolean(filters) || Boolean(sort);
  const hasTrailing = Boolean(actions) || Boolean(search);

  return (
    <div
      className={cn(
        'backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-200 motion-reduce:transition-none',
        sticky
          ? 'sticky top-0 z-10 -mx-[var(--pg-gutter)] bg-background/80 px-[var(--pg-gutter)] py-2.5 md:mx-0 md:rounded-xl md:border md:border-border/60 md:bg-card/80 md:px-3 md:shadow-sm'
          : 'rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm',
        className,
      )}
    >
      {(hasLeading || hasTrailing) && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3">
          {hasLeading ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}{sort}</div>
          ) : null}
          {hasTrailing ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:justify-end">
              {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
              {search ? <div className="w-full min-w-0 sm:w-auto sm:min-w-[14rem]">{search}</div> : null}
            </div>
          ) : null}
        </div>
      )}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
