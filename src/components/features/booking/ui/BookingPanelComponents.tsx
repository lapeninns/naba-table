import { GuestPanel, GuestPanelHeader } from '@/components/guest/ui';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { toneClasses, type StatusTone } from './bookingUiTone';

import type { ElementType, ReactNode } from 'react';

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
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
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
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <row.icon className="size-4" aria-hidden />
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
