'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/* ============================================================================
   LAYOUT PRIMITIVES
   ============================================================================ */

type PaddingSize = 'sm' | 'md' | 'lg';

const paddingMap: Record<PaddingSize, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

type SectionProps = {
  title?: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: PaddingSize;
};

export function GuestSection({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  padding = 'lg',
}: SectionProps) {
  return (
    <section
      className={cn(
        'relative flex flex-col gap-6 rounded-3xl',
        'border border-border bg-background',
        'shadow-[0_1px_2px_rgba(0,0,0,0.05)]', // shadow-sm
        paddingMap[padding],
        className,
      )}
    >
      {(eyebrow || title || description || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {eyebrow ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2 className="text-2xl font-bold leading-tight text-foreground">{title}</h2>
            ) : null}
            {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
