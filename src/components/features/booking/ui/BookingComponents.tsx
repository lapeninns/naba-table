import Link from 'next/link';

import { GuestPanel, GuestPanelHeader } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { ElementType, ReactNode } from 'react';

type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<StatusTone, { badge: string; text: string; icon: string }> = {
  default: {
    badge: 'border-border bg-muted text-foreground',
    text: 'text-muted-foreground',
    icon: 'bg-muted text-muted-foreground',
  },
  success: {
    badge: 'border-primary/20 bg-primary/10 text-primary',
    text: 'text-primary',
    icon: 'bg-primary/10 text-primary',
  },
  warning: {
    badge: 'border-border bg-muted text-foreground',
    text: 'text-foreground',
    icon: 'bg-muted text-foreground',
  },
  danger: {
    badge: 'pg-danger-badge',
    text: 'pg-danger-text',
    icon: 'pg-danger-icon',
  },
  info: {
    badge: 'border-primary/20 bg-primary/10 text-primary',
    text: 'text-primary',
    icon: 'bg-primary/10 text-primary',
  },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="pg-page pb-20">
      <div className="pg-container space-y-6 py-6 sm:space-y-8 sm:py-8 lg:py-10">{children}</div>
    </section>
  );
}

export function BookingMessageShell({
  icon: Icon,
  title,
  description,
  actions,
  tone = 'info',
}: {
  icon: ElementType;
  title: ReactNode;
  description: ReactNode;
  actions: ReactNode;
  tone?: StatusTone;
}) {
  const palette = toneClasses[tone];

  return (
    <section className="pg-section-tight pg-page">
      <div className="pg-container-sm">
        <GuestPanel className="pg-appear space-y-6 p-6 text-center sm:p-8">
          <div
            className={cn(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full border',
              palette.badge,
            )}
          >
            <Icon className="h-7 w-7" aria-hidden />
          </div>
          <div className="space-y-3">
            <h1 className="pg-hero-title">{title}</h1>
            <p className="pg-body mx-auto max-w-xl">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>
        </GuestPanel>
      </div>
    </section>
  );
}

export function BookingSummaryCard({
  title,
  reference,
  description,
  backHref = '/guest/dashboard',
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
    <GuestPanel className="pg-appear overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={backHref}
              className="pg-focus-ring inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <span className="sr-only">Back</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
              </svg>
            </Link>
            <Badge
              className={cn(
                'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.12em]',
                tone.badge,
              )}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {status.label}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="pg-kicker">Reservation summary</p>
            <h1 className="pg-hero-title">{title}</h1>
            {description ? <p className="pg-body max-w-[65ch]">{description}</p> : null}
          </div>
          {offlineNotice}
        </div>

        <div className="flex flex-col justify-between gap-5 border-t border-border bg-muted/35 p-6 lg:border-l lg:border-t-0">
          <div className="rounded-[var(--pg-radius-lg)] border border-border/80 bg-background p-4 text-center shadow-[var(--pg-shadow-xs)]">
            <p className="font-[var(--pg-font-mono)] text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Reference
            </p>
            <p className="mt-1 break-all font-[var(--pg-font-mono)] text-xl font-semibold tracking-[0.18em] text-foreground">
              {reference}
            </p>
          </div>
          {actions}
        </div>
      </div>
    </GuestPanel>
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
    <GuestPanel className="flex h-full flex-col gap-3 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="pg-kicker text-[0.68rem]">{label}</p>
        <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
        {subtext ? <p className="pg-caption mt-1">{subtext}</p> : null}
      </div>
    </GuestPanel>
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
    <GuestPanel className="overflow-hidden">
      <GuestPanelHeader title={title} />
      <div className="divide-y divide-border/60">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-start gap-4 px-5 py-4 sm:px-6">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <row.icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="pg-kicker text-[0.68rem]">{row.label}</p>
              <div className="break-words text-sm font-semibold text-foreground sm:text-base">
                {row.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GuestPanel>
  );
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row md:hidden">{children}</div>;
}

export function BookingSidebarCard({ children }: { children: ReactNode }) {
  return <GuestPanel className="overflow-hidden">{children}</GuestPanel>;
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
      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <p className="pg-kicker">Booking actions</p>
          <h3 className="pg-card-title">{title}</h3>
        </div>
        {actions}
        {footer ? <Separator className="my-2" /> : null}
        {footer}
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
    <div
      className={cn(
        'rounded-[var(--pg-radius-md)] border px-4 py-3 text-sm font-medium',
        palette.badge,
        palette.text,
      )}
    >
      {children}
    </div>
  );
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      asChild
      className="pg-action pg-focus-ring pg-touch rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
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
      variant="outline"
      className="pg-action pg-focus-ring pg-touch w-full justify-center rounded-full border-border px-5 font-medium hover:bg-muted"
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
      className="pg-action pg-focus-ring pg-touch w-full justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
