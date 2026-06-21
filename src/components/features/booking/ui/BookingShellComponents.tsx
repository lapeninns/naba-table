import Link from 'next/link';

import { GuestPanel } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { toneClasses, type StatusTone } from './bookingUiTone';

import type { ElementType, ReactNode } from 'react';

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
            <Icon className="size-7" aria-hidden />
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
              <Icon className="mr-1.5 size-3.5" aria-hidden />
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
