import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { ElementType, ReactNode } from 'react';

type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<StatusTone, { badge: string; text: string }> = {
  default: { badge: 'bg-muted text-foreground', text: 'text-muted-foreground' },
  success: { badge: 'bg-primary/10 text-primary border-primary/20', text: 'text-primary' },
  warning: { badge: 'bg-muted text-foreground border-border', text: 'text-muted-foreground' },
  danger: { badge: 'bg-red-50 text-red-700 border-red-100', text: 'text-red-600' },
  info: { badge: 'bg-primary/10 text-primary border-primary/20', text: 'text-primary' },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-[100dvh] bg-surface-warm py-8 pb-20 sm:py-10">
      <div className="pg-container space-y-6 sm:space-y-8">{children}</div>
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
    <section className="pg-section-tight bg-surface-warm">
      <div className="pg-container-sm">
        <Card
          variant="featured"
          className="pg-card animate-fade-in-up space-y-6 p-6 text-center sm:p-8"
        >
          <div
            className={cn(
              'mx-auto flex h-16 w-16 items-center justify-center rounded-full border',
              palette.badge,
            )}
          >
            <Icon className="h-7 w-7" aria-hidden />
          </div>
          <div className="space-y-3">
            <h1 className="heading-hero">{title}</h1>
            <p className="text-body-warm mx-auto max-w-xl">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">{actions}</div>
        </Card>
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
    <Card
      variant="featured"
      className="pg-card animate-fade-in-up space-y-6 bg-surface-elevated p-6 sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-full bg-muted p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors min-h-[44px] min-w-[44px]"
            >
              <span className="sr-only">Back</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z" />
              </svg>
            </Link>
            <Badge
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border',
                tone.badge,
              )}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {status.label}
            </Badge>
          </div>

          <div>
            <h1 className="heading-hero">{title}</h1>
            {description ? <p className="mt-2 text-body-warm">{description}</p> : null}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <span>REF:</span>
            <span className="font-bold text-foreground">{reference}</span>
          </div>
        </div>
        {actions ? <div className="flex flex-col gap-3 sm:flex-row pt-2">{actions}</div> : null}
      </div>
      {offlineNotice}
    </Card>
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
    <Card variant="interactive" className="pg-card flex flex-col gap-3 p-5">
      <div className="flex justify-between items-start">
        <div className="p-2.5 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="text-subtle text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
        <div className="heading-subsection">{value}</div>
        {subtext ? <div className="text-sm text-subtle mt-0.5 font-medium">{subtext}</div> : null}
      </div>
    </Card>
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
    <Card className="pg-card overflow-hidden rounded-3xl">
      <div className="border-b border-border/50 bg-muted/50 px-6 py-4">
        <h3 className="heading-subsection">{title}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <row.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {row.label}
              </p>
              <p className="heading-subsection truncate">{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row md:hidden">{children}</div>;
}

export function BookingSidebarCard({ children }: { children: ReactNode }) {
  return <Card className="pg-card overflow-hidden rounded-3xl">{children}</Card>;
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
      <div className="space-y-6 p-6">
        <h3 className="heading-subsection">{title}</h3>
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
        'rounded-2xl border px-4 py-3 text-sm font-medium',
        palette.badge,
        palette.text,
      )}
    >
      {children}
    </div>
  );
}

export function SummaryActions({ children }: { children: ReactNode }) {
  return <div className="hidden items-center gap-3 md:flex">{children}</div>;
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      asChild
      className="min-h-[48px] rounded-full bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
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
      className="min-h-[44px] w-full justify-center rounded-full border-border px-5 font-medium hover:bg-muted btn-tactile focus-ring touch-feedback sm:w-auto"
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
      className="min-h-[44px] w-full justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:w-auto"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
