import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

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
  featured?: boolean;
};

type GuestMetricCardProps = {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

type GuestInsetCardProps = {
  icon?: LucideIcon;
  label?: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

type GuestDetailItem = {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
};

type GuestRouteCardProps = {
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  href: string;
  actionLabel: string;
  eyebrow?: ReactNode;
  featured?: boolean;
  meta?: ReactNode;
  onAction?: () => void;
  className?: string;
};

type GuestJourneyStep = {
  label: string;
  title: ReactNode;
  description: ReactNode;
  href?: string;
};

export function GuestPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('guest-theme pg-page overflow-x-clip pb-16 sm:pb-20', className)}>
      {children}
    </div>
  );
}

export function GuestContent({
  children,
  className,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        narrow ? 'pg-container-sm' : 'pg-container',
        'space-y-6 py-6 sm:space-y-8 sm:py-8 lg:space-y-10 lg:py-10',
        className,
      )}
    >
      {children}
    </div>
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
    <section
      className={cn(
        'pg-hero-band relative isolate overflow-hidden',
        compact ? 'py-6 sm:py-8 lg:py-10' : 'py-10 sm:py-14 lg:py-20',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pg-hero-edge-line pointer-events-none absolute inset-x-0 top-0 h-px"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-8 h-56 w-56 rounded-full bg-primary/[0.09] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-[-5rem] h-64 w-64 rounded-full bg-[color:color-mix(in_srgb,var(--pg-text)_7%,transparent)] blur-3xl"
      />

      <div
        className={cn(
          'pg-container relative grid gap-6 lg:gap-10',
          aside ? 'lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)] lg:items-start' : '',
        )}
      >
        <div className="pg-appear flex min-w-0 flex-col gap-5 sm:gap-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="pg-chip bg-background/85 text-[0.68rem] font-semibold uppercase tracking-[0.16em] shadow-[var(--pg-shadow-xs)]">
              {eyebrow}
            </span>
            {compact ? (
              <span className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Guest experience
              </span>
            ) : null}
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h1 className="pg-hero-title max-w-[14ch]">{title}</h1>
            {description ? <p className="pg-lead max-w-[65ch]">{description}</p> : null}
          </div>

          {meta ? <div className="flex flex-wrap gap-2.5">{meta}</div> : null}

          {actions ? (
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">{actions}</div>
          ) : null}
        </div>

        {aside ? <div className="pg-appear relative lg:pl-2">{aside}</div> : null}
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
      className={cn(
        'grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end',
        className,
      )}
    >
      <div className="space-y-2.5">
        {eyebrow ? <p className="pg-kicker">{eyebrow}</p> : null}
        <h2 className="pg-section-title max-w-[22ch]">{title}</h2>
        {description ? <p className="pg-lead max-w-[62ch] text-base">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

export function GuestPanel({
  children,
  className,
  interactive = false,
  ...props
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card
      className={cn(
        'pg-panel relative overflow-hidden border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_90%,white)] text-foreground shadow-[var(--pg-shadow-edge)]',
        'pg-panel-edge before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
        interactive &&
          'pg-card-interactive focus-within:border-primary/25 focus-within:bg-background/92 hover:border-primary/25 hover:bg-background/92 hover:shadow-[var(--pg-shadow-md)]',
        className,
      )}
      data-interactive={interactive || undefined}
      {...props}
    >
      {children}
    </Card>
  );
}

export function GuestPanelHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6',
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow ? <p className="pg-kicker">{eyebrow}</p> : null}
        <h3 className="pg-card-title">{title}</h3>
        {description ? <p className="pg-caption max-w-[52ch]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function GuestInsetCard({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: GuestInsetCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--pg-radius-md)] border border-border/70 bg-background/80 p-4 shadow-[var(--pg-shadow-xs)]',
        className,
      )}
    >
      {Icon ? <Icon className="mb-3 h-4 w-4 text-primary" aria-hidden /> : null}
      {label ? <p className="pg-kicker text-[0.68rem]">{label}</p> : null}
      <div className={cn(label ? 'mt-1' : '')}>
        <div className="text-sm font-semibold text-foreground">{value}</div>
        {detail ? <p className="pg-caption mt-1">{detail}</p> : null}
      </div>
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
  featured = false,
}: GuestActionCardProps) {
  return (
    <GuestPanel
      interactive={Boolean(href)}
      className={cn(
        'flex h-full flex-col gap-5 p-5 sm:p-6',
        featured && 'border-primary/25 bg-primary/[0.04]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {eyebrow ? (
          <Badge variant="guest-chip" className="pg-chip">
            {eyebrow}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <h3 className="pg-card-title">{title}</h3>
        <p className="pg-body text-sm">{description}</p>
      </div>

      {children ? (
        <div className="rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
          {children}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {href && actionLabel ? (
          <GuestPrimaryButton href={href}>{actionLabel}</GuestPrimaryButton>
        ) : null}
        {actions}
      </div>
    </GuestPanel>
  );
}

export function GuestRouteCard({
  icon: Icon,
  title,
  description,
  href,
  actionLabel,
  eyebrow,
  featured = false,
  meta,
  onAction,
  className,
}: GuestRouteCardProps) {
  return (
    <GuestPanel
      interactive
      className={cn(
        'group flex h-full flex-col gap-5 p-5 sm:p-6',
        featured && 'border-primary/25 bg-primary/[0.04]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {eyebrow ? (
          <Badge variant="guest-chip-outline" className="pg-chip">
            {eyebrow}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <h3 className="pg-card-title">{title}</h3>
        <p className="pg-body text-sm">{description}</p>
        {meta ? (
          <div className="rounded-[var(--pg-radius-md)] border border-border/70 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>

      <Button
        asChild
        variant={featured ? 'guest-primary' : 'guest-outline'}
        size="guest-lg"
        className="pg-action pg-focus-ring pg-touch mt-auto w-full justify-between"
      >
        <Link href={href} onClick={onAction}>
          {actionLabel}
          <ArrowRight aria-hidden data-icon="inline-end" />
        </Link>
      </Button>
    </GuestPanel>
  );
}

export function GuestJourneyMap({
  steps,
  className,
}: {
  steps: readonly GuestJourneyStep[];
  className?: string;
}) {
  return (
    <ol className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4', className)}>
      {steps.map((step, index) => {
        const content = (
          <div className="flex h-full flex-col gap-3 rounded-[var(--pg-radius-md)] border border-border/75 bg-background/85 p-4 shadow-[var(--pg-shadow-xs)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {step.label}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                {index + 1}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
            </div>
          </div>
        );

        return (
          <li key={step.label} className="min-w-0">
            {step.href ? (
              <Link href={step.href} className="pg-focus-ring block rounded-[var(--pg-radius-md)]">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
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
    <GuestPanel className={cn('flex h-full flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="pg-kicker text-[0.68rem]">{label}</p>
          <p className="font-[var(--pg-font-mono)] text-2xl font-semibold tracking-tight text-foreground sm:text-[1.9rem]">
            {value}
          </p>
        </div>
        {Icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      {detail ? <p className="pg-caption max-w-[20ch]">{detail}</p> : null}
    </GuestPanel>
  );
}

export function GuestDetailList({
  title,
  items,
  className,
}: {
  title?: ReactNode;
  items: GuestDetailItem[];
  className?: string;
}) {
  return (
    <GuestPanel className={cn('overflow-hidden', className)}>
      {title ? <GuestPanelHeader title={title} /> : null}
      <div className="divide-y divide-border/60">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="grid gap-4 px-5 py-4 sm:grid-cols-[auto_1fr] sm:px-6">
              {Icon ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-primary shadow-[var(--pg-shadow-xs)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="pg-kicker text-[0.68rem]">{item.label}</p>
                <div className="break-words pt-1 text-sm font-semibold text-foreground sm:text-base">
                  {item.value}
                </div>
                {item.detail ? <p className="pg-caption mt-1">{item.detail}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </GuestPanel>
  );
}

export function GuestSplitPanel({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-[7fr_5fr] lg:gap-8', className)}>
      <div className="min-w-0 space-y-6">{primary}</div>
      <aside className="space-y-6">{secondary}</aside>
    </div>
  );
}

export function GuestReferenceStrip({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--pg-radius-lg)] border border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_86%,white)] px-4 py-3 shadow-[var(--pg-shadow-edge)] sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {label}: <span className="font-semibold tracking-[0.14em] text-foreground">{value}</span>
        </p>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
      {children ? <Separator className="mt-3 sm:hidden" /> : null}
    </div>
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
      size="guest-lg"
      variant="guest-primary"
      className={cn('pg-action pg-focus-ring pg-touch font-semibold', className)}
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
      size="guest-lg"
      variant="guest-outline"
      className={cn('pg-action pg-focus-ring pg-touch', className)}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function GuestGhostButton({
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
      size="guest-lg"
      variant="guest-ghost"
      className={cn('pg-action pg-focus-ring pg-touch', className)}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
