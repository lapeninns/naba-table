'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import {
  GuestMetricCard,
  GuestPanel,
  GuestPanelHeader,
} from '@/components/guest/ui/GuestPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { CSSProperties, ReactNode } from 'react';

export { GuestEmpty, GuestError, GuestStatus } from './GuestFeedback';

export function HeadingXL({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h1 className={cn('pg-hero-title', className)}>{children}</h1>;
}

export function HeadingLG({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn('pg-section-title', className)}>{children}</h2>;
}

export function HeadingMD({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn('pg-card-title', className)}>{children}</h3>;
}

export function TextBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('pg-body', className)}>{children}</p>;
}

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

/**
 * @deprecated Prefer `GuestPanel` + `GuestPanelHeader` from `@/components/guest/ui`.
 */
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
    <GuestPanel className={cn('flex flex-col gap-0 overflow-hidden', className)}>
      {(eyebrow || title || description || actions) && (
        <GuestPanelHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={actions}
        />
      )}
      <div className={cn('flex flex-col gap-6', paddingMap[padding])}>{children}</div>
    </GuestPanel>
  );
}

type GuestCardProps = {
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * @deprecated Prefer shadcn `Card` composition or `GuestPanel`.
 */
export function GuestCard({ header, footer, className, style, children }: GuestCardProps) {
  return (
    <Card
      className={cn(
        'pg-panel overflow-hidden border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_88%,white)] shadow-[var(--pg-shadow-edge)]',
        className,
      )}
      style={style}
    >
      {header ? (
        <CardHeader className="border-b border-border/60 px-6 py-5">
          {typeof header === 'string' ? <CardTitle>{header}</CardTitle> : header}
        </CardHeader>
      ) : null}
      <CardContent className="p-6 text-foreground">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t border-border/60 px-6 py-5">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

/**
 * @deprecated Prefer `GuestMetricCard` from `@/components/guest/ui`.
 */
export function MetricTile({
  label,
  value,
  detail,
  icon,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ElementType;
  variant?: 'default' | 'highlight';
}) {
  return (
    <GuestMetricCard
      icon={icon as never}
      label={label}
      value={value}
      detail={detail}
      className={variant === 'highlight' ? 'border-primary/25 bg-primary/[0.04]' : undefined}
    />
  );
}

/**
 * @deprecated Prefer `GuestActionCard` from `@/components/guest/ui`.
 */
export function ActionCard({
  icon: IconComp,
  label,
  description,
  href,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
          <IconComp className="h-5 w-5" aria-hidden />
        </span>
        <ChevronRight className="h-5 w-5 text-muted-foreground/60" aria-hidden />
      </span>
      <span className="flex flex-col gap-2">
        <span className="pg-card-title">{label}</span>
        <span className="pg-body text-sm">{description}</span>
      </span>
    </>
  );

  return (
    <Card
      className={cn(
        'pg-panel pg-card-interactive h-full border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_88%,white)] shadow-[var(--pg-shadow-edge)]',
        'focus-within:border-primary/25 hover:border-primary/25 hover:shadow-[var(--pg-shadow-md)]',
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 p-5">
        {href ? (
          <Link href={href} className="flex h-full flex-col gap-4 rounded-[var(--pg-radius-md)]">
            {content}
          </Link>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="flex h-full flex-col items-stretch justify-start gap-4 whitespace-normal p-0 text-left hover:bg-transparent"
            onClick={onClick}
          >
            {content}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * @deprecated Keep search forms route-owned; use shadcn `Input` and `Button` directly.
 */
export function SearchBar({ onSearch }: { onSearch?: () => void }) {
  return (
    <Card className="pg-panel relative z-20 mx-auto w-full max-w-5xl overflow-hidden border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_90%,white)] p-2 shadow-[var(--pg-shadow-edge)] md:rounded-[calc(var(--pg-radius-pill)+0.25rem)]">
      <CardContent className="flex flex-col gap-0 p-0 md:flex-row md:items-center">
        <label className="group relative w-full border-b border-border px-5 py-3 transition-colors hover:bg-muted/40 md:flex-1 md:border-b-0 md:px-6 md:rounded-l-full">
          <span className="mb-0.5 block text-xs font-bold uppercase tracking-wide text-foreground">
            Where
          </span>
          <Input
            type="text"
            placeholder="Search destinations"
            className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
        <Separator orientation="vertical" className="hidden h-8 md:block" />
        {['Date', 'Time', 'Who'].map((label) => (
          <div
            key={label}
            className="group w-full border-b border-border px-5 py-3 transition-colors hover:bg-muted/40 md:flex-1 md:border-b-0 md:px-6"
          >
            <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-foreground">
              {label}
            </p>
            <p className="text-sm text-muted-foreground">
              {label === 'Who' ? 'Add guests' : `Add ${label.toLowerCase()}`}
            </p>
          </div>
        ))}
        <div className="w-full p-2 md:w-auto">
          <Button
            type="button"
            onClick={onSearch}
            variant="guest-primary"
            size="guest-lg"
            className="pg-action pg-focus-ring pg-touch w-full md:w-auto"
          >
            <Search data-icon="inline-start" />
            <span className="px-2 md:hidden lg:inline">Search</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
