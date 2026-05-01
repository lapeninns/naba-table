'use client';

import { cn } from '@/lib/utils';

import type { ElementType, ReactNode, Ref } from 'react';

export type OpsPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3';
  headerRef?: Ref<HTMLElement>;
  className?: string;
  titleClassName?: string;
};

const headingStyles: Record<NonNullable<OpsPageHeaderProps['headingLevel']>, string> = {
  h1: 'text-2xl font-bold tracking-tight text-foreground sm:text-3xl',
  h2: 'text-xl font-semibold tracking-tight text-foreground sm:text-2xl',
  h3: 'text-lg font-semibold tracking-tight text-foreground',
};

export function OpsPageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  primaryAction,
  secondaryActions,
  headingLevel = 'h1',
  headerRef,
  className,
  titleClassName,
}: OpsPageHeaderProps) {
  const Heading = headingLevel as ElementType;
  return (
    <header
      ref={headerRef}
      className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}
    >
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Heading className={cn(headingStyles[headingLevel], titleClassName)}>{title}</Heading>
        </div>
        {subtitle ? (
          <div className="text-sm text-muted-foreground sm:text-base">{subtitle}</div>
        ) : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:text-base">
            {meta}
          </div>
        ) : null}
      </div>

      {primaryAction || secondaryActions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
