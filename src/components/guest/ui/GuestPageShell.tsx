import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type GuestHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  className?: string;
  compact?: boolean;
};

type GuestSectionHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

type GuestActionCardProps = {
  icon: LucideIcon;
  eyebrow?: string;
  title: ReactNode;
  description: ReactNode;
  href?: string;
  actionLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type GuestMetricCardProps = {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function GuestPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('pg-surface min-h-[100dvh] pb-16 sm:pb-20', className)}>{children}</div>
  );
}

export function GuestHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  meta,
  className,
  compact = false,
}: GuestHeroProps) {
  return (
    <section className={cn('pg-hero-band', compact ? 'pg-section-tight' : 'pg-section', className)}>
      <div
        className={cn(
          'pg-container grid gap-6',
          aside ? 'lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-10' : '',
        )}
      >
        <div className="pg-appear flex max-w-3xl flex-col gap-4">
          <div className="space-y-3">
            <p className="pg-kicker">{eyebrow}</p>
            <h1 className="pg-hero-title">{title}</h1>
            {description ? <p className="pg-lead max-w-[65ch]">{description}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
          {actions ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>
          ) : null}
        </div>
        {aside ? <div className="pg-appear lg:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
}

export function GuestSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: GuestSectionHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="pg-kicker">{eyebrow}</p> : null}
        <h2 className="pg-section-title">{title}</h2>
        {description ? <p className="pg-body max-w-[65ch]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function GuestActionCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  actions,
  children,
  className,
}: GuestActionCardProps) {
  return (
    <Card className={cn('pg-card flex h-full flex-col gap-5 p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {eyebrow ? (
          <Badge variant="secondary" className="pg-chip">
            {eyebrow}
          </Badge>
        ) : null}
      </div>
      <div className="space-y-2">
        <h3 className="pg-card-title">{title}</h3>
        <p className="pg-body text-sm">{description}</p>
      </div>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {href && actionLabel ? (
          <Button asChild className="pg-action pg-focus-ring pg-touch rounded-full">
            <Link href={href}>{actionLabel}</Link>
          </Button>
        ) : null}
        {actions}
      </div>
    </Card>
  );
}

export function GuestMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: GuestMetricCardProps) {
  return (
    <Card className={cn('pg-card flex h-full flex-col gap-3 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="pg-kicker text-[0.68rem]">{label}</p>
        {Icon ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-[var(--pg-font-mono)] text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {value}
        </p>
        {detail ? <p className="pg-caption mt-1">{detail}</p> : null}
      </div>
    </Card>
  );
}

export function GuestPrimaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      asChild
      size="lg"
      className={cn('pg-action pg-focus-ring pg-touch rounded-full', className)}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function GuestSecondaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={cn(
        'pg-action pg-focus-ring pg-touch rounded-full border-border bg-background',
        className,
      )}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
