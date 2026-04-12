import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ElementType, ReactNode } from 'react';

type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<
  StatusTone,
  {
    badge: string;
    marker: string;
    alert: string;
  }
> = {
  default: {
    badge: 'bg-[var(--luminous-surface-highest)] text-foreground',
    marker: 'bg-foreground/55',
    alert: 'bg-[var(--luminous-surface-highest)] text-foreground',
  },
  success: {
    badge: 'bg-[var(--luminous-tone-success-bg)] text-[var(--luminous-tone-success-text)]',
    marker: 'bg-[var(--luminous-tone-success-marker)]',
    alert: 'bg-[var(--luminous-tone-success-bg)] text-[var(--luminous-tone-success-text)]',
  },
  warning: {
    badge: 'bg-[var(--luminous-tone-warning-bg)] text-[var(--luminous-tone-warning-text)]',
    marker: 'bg-[var(--luminous-tone-warning-marker)]',
    alert: 'bg-[var(--luminous-tone-warning-bg)] text-[var(--luminous-tone-warning-text)]',
  },
  danger: {
    badge: 'bg-[var(--luminous-tone-danger-bg)] text-[var(--luminous-tone-danger-text)]',
    marker: 'bg-[var(--luminous-tone-danger-marker)]',
    alert: 'bg-[var(--luminous-tone-danger-bg)] text-[var(--luminous-tone-danger-text)]',
  },
  info: {
    badge: 'bg-[var(--luminous-primary-tint-strong)] text-primary',
    marker: 'bg-primary',
    alert: 'bg-[var(--luminous-primary-tint)] text-primary',
  },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-screen bg-transparent pb-[var(--luminous-space-grand)] pt-2 sm:pt-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--luminous-space-breath)]">{children}</div>
    </section>
  );
}

export function BookingSummaryCard({
  title,
  reference,
  description,
  backHref = '/bookings',
  status,
  offlineNotice,
  actions,
}: {
  title: ReactNode;
  reference: ReactNode;
  description?: ReactNode;
  backHref?: string;
  status: { icon: ElementType; label: string; tone?: StatusTone };
  offlineNotice?: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = status.icon;
  const tone = toneClasses[status.tone ?? 'default'];

  return (
    <div className="luminous-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--luminous-primary-container)_16%,transparent),transparent_54%)]" />
      <div className="relative space-y-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="ghost"
                className="luminous-ghost h-auto min-h-[44px] rounded-[var(--luminous-radius)] px-2 text-muted-foreground hover:text-foreground"
              >
                <Link href={backHref}>Back</Link>
              </Button>

              <Badge
                className={cn(
                  'rounded-full border-0 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em]',
                  tone.badge,
                )}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {status.label}
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="heading-page max-w-3xl">{title}</h1>
              {description ? (
                <p className="text-body-warm luminous-copy-measure text-[1.02rem]">{description}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <div className={cn('h-2.5 w-2.5 rounded-full', tone.marker)} />
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Reservation reference
              </div>
              <div className="font-mono text-sm font-semibold text-foreground">{reference}</div>
            </div>
          </div>

          {actions ? (
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[16rem] lg:max-w-[18rem]">
              {actions}
            </div>
          ) : null}
        </div>

        {offlineNotice}
      </div>
    </div>
  );
}

export function DetailStatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
}) {
  return (
    <article className="luminous-card relative flex min-h-[10rem] flex-col justify-between gap-4 overflow-hidden px-5 py-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--luminous-primary)] to-[var(--luminous-primary-container)] opacity-[0.12]" />
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--luminous-radius)] bg-[var(--luminous-primary-tint)] text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="space-y-1">
        <div className="heading-section text-[clamp(1.35rem,3vw,1.75rem)]">{value}</div>
        {subtext ? <p className="text-sm leading-6 text-muted-foreground">{subtext}</p> : null}
      </div>
    </article>
  );
}

export function InfoPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ icon: ElementType; label: string; value: ReactNode }>;
}) {
  return (
    <section className="luminous-panel px-6 py-6 sm:px-7 sm:py-7">
      <div className="space-y-4">
        <h2 className="heading-subsection">{title}</h2>

        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="luminous-card grid gap-3 px-4 py-4 sm:grid-cols-[2.25rem_minmax(8rem,12rem)_1fr] sm:items-start"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--luminous-radius)] bg-[var(--luminous-primary-tint)] text-primary">
                <row.icon className="h-4.5 w-4.5" aria-hidden />
              </div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:pt-2">
                {row.label}
              </p>
              <div className="text-sm font-semibold leading-6 text-foreground sm:pt-1.5">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:hidden">{children}</div>;
}

export function BookingSidebarCard({ children }: { children: ReactNode }) {
  return <aside className="luminous-panel px-5 py-5 sm:px-6">{children}</aside>;
}

export function ManageBookingPanel({
  title,
  actions,
  footer,
}: {
  title: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <BookingSidebarCard>
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="luminous-kicker">Actions</p>
          <h2 className="heading-subsection">{title}</h2>
        </div>
        <div className="grid gap-3">{actions}</div>
        {footer ? <div className="luminous-card-soft rounded-[var(--luminous-radius)] px-4 py-4">{footer}</div> : null}
      </div>
    </BookingSidebarCard>
  );
}

export function InlineAlert({
  tone = 'info',
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  const palette = toneClasses[tone];
  return (
    <div className={cn('rounded-[var(--luminous-radius)] px-4 py-3 text-sm font-medium', palette.alert)}>
      {children}
    </div>
  );
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="hidden flex-col gap-3 md:flex">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      asChild
      size="lg"
      className="luminous-cta btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-6 text-white"
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function SecondaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="secondary"
      size="lg"
      className="luminous-secondary btn-tactile min-h-[46px] justify-center rounded-[var(--luminous-radius)] px-5"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

export function GhostButton({
  onClick,
  children,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="lg"
      className="luminous-ghost min-h-[44px] justify-center rounded-[var(--luminous-radius)] px-4"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
