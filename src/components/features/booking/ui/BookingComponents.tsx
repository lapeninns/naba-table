import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { ElementType, ReactNode } from 'react';

type StatusTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<StatusTone, { badge: string; text: string }> = {
  default: { badge: 'bg-slate-200 text-slate-800 border-slate-300', text: 'text-slate-700' },
  success: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    text: 'text-emerald-700',
  },
  warning: { badge: 'bg-amber-100 text-amber-900 border-amber-200', text: 'text-amber-800' },
  danger: { badge: 'bg-red-100 text-red-900 border-red-200', text: 'text-red-800' },
  info: { badge: 'bg-blue-100 text-blue-900 border-blue-200', text: 'text-blue-800' },
};

export function BookingDetailShell({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-screen bg-surface-warm py-8 sm:py-10 pb-20">
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8 px-6">{children}</div>
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
      className="space-y-6 p-6 sm:p-8 bg-surface-elevated animate-fade-in-up"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors min-h-[44px] min-w-[44px]"
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

          <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
            <span>REF:</span>
            <span className="font-bold text-slate-700">{reference}</span>
          </div>
        </div>
        {actions ? <div className="flex flex-col gap-3 sm:flex-row pt-2">{actions}</div> : null}
      </div>
      {offlineNotice}
    </Card>
  );
}

export function DetailStatCard({
  icon: iconComponent,
  label,
  value,
  subtext,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
}) {
  const Icon = iconComponent;
  return (
    <Card variant="interactive" className="flex flex-col gap-3 p-5">
      <div className="flex justify-between items-start">
        <div className="p-2.5 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
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
    <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
        <h3 className="heading-subsection">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center gap-4 px-6 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
              <row.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
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
  return <div className="flex gap-3 md:hidden">{children}</div>;
}

export function BookingSidebarCard({ children }: { children: ReactNode }) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {children}
    </Card>
  );
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
      className="rounded-full bg-primary hover:bg-primary/90 text-white font-semibold px-6 min-h-[48px]"
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
      className="rounded-full border-slate-200 hover:bg-slate-50 font-medium px-5 min-h-[44px] btn-tactile focus-ring touch-feedback"
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
      className="rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 min-h-[44px]"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
