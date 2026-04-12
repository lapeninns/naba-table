'use client';

import { AlertCircle, CheckCircle2, Info, Sparkles, Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import React, {
  forwardRef,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ============================================================================
   TYPOGRAPHY
   ============================================================================ */

export function HeadingXL({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h1 className={cn('heading-hero', className)}>{children}</h1>;
}

export function HeadingLG({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn('heading-page', className)}>{children}</h2>;
}

export function HeadingMD({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn('heading-section', className)}>{children}</h3>;
}

export function TextBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn('text-body-warm', className)}>{children}</p>;
}

/* ============================================================================
   LAYOUT PRIMITIVES
   ============================================================================ */

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
    <section
      className={cn(
        'relative flex flex-col gap-6 rounded-3xl',
        'border border-border bg-background',
        'shadow-[0_1px_2px_rgba(0,0,0,0.05)]', // shadow-sm
        paddingMap[padding],
        className,
      )}
    >
      {(eyebrow || title || description || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {eyebrow ? (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {eyebrow}
              </span>
            ) : null}
            {title ? (
              <h2 className="text-2xl font-bold leading-tight text-foreground">{title}</h2>
            ) : null}
            {description ? <p className="text-base text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

type GuestCardProps = {
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function GuestCard({ header, footer, className, style, children }: GuestCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border bg-background',
        'shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow duration-200 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08)]',
        className,
      )}
      style={style}
    >
      {header ? <div className="p-6 pb-2 text-foreground font-semibold">{header}</div> : null}
      <div className="p-6 text-foreground">{children}</div>
      {footer ? <div className="p-6 pt-2 border-t border-border/30">{footer}</div> : null}
    </div>
  );
}

/* ============================================================================
   WIDGETS (MetricTile, ActionCard, SearchBar)
   ============================================================================ */

export function MetricTile({
  label,
  value,
  detail,
  icon: IconComp,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: React.ElementType;
  variant?: 'default' | 'highlight';
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-4 rounded-xl border p-6 transition-all duration-200',
        'bg-background border-border shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        'hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5',
      )}
    >
      <div className="flex justify-between items-start">
        <div
          className={cn(
            'p-2.5 rounded-full flex items-center justify-center',
            variant === 'highlight' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground',
          )}
        >
          {IconComp ? <IconComp className="w-5 h-5" /> : null}
        </div>
        {detail && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary">
            {detail}
          </span>
        )}
      </div>
      <div>
        <div className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-foreground text-3xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

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
  const Wrapper = href ? Link : 'button';
  const props = href ? { href } : { onClick };

  return (
    // @ts-expect-error - Intentionally using specific styles for this variation
    <Wrapper
      {...props}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all duration-200',
        'bg-background border-border shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        'hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-1',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <IconComp className="h-6 w-6" />
      </div>
      <div>
        <div className="font-semibold text-foreground">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/50 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
    </Wrapper>
  );
}

export function SearchBar({ onSearch }: { onSearch?: () => void }) {
  return (
    <div className="flex flex-col md:flex-row items-center bg-background rounded-3xl md:rounded-full border border-border shadow-[0_6px_16px_rgba(0,0,0,0.08)] p-2 max-w-4xl w-full mx-auto relative z-20">
      {/* Location */}
      <div className="w-full md:flex-1 px-6 py-3 cursor-pointer relative group border-b md:border-b-0 border-border transition-colors hover:bg-muted/50 md:rounded-l-full">
        <label className="block text-xs font-bold text-foreground mb-0.5 uppercase tracking-wide">
          Where
        </label>
        <input
          type="text"
          placeholder="Search destinations"
          className="w-full bg-transparent border-none p-0 text-sm text-muted-foreground placeholder:text-muted-foreground/70 focus:ring-0 focus:outline-none"
        />
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-border group-hover:hidden"></div>
      </div>

      {/* Date */}
      <div className="w-full md:flex-1 px-6 py-3 cursor-pointer relative group border-b md:border-b-0 border-border transition-colors hover:bg-muted/50">
        <label className="block text-xs font-bold text-foreground mb-0.5 uppercase tracking-wide">
          Date
        </label>
        <div className="text-sm text-muted-foreground">Add dates</div>
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-border group-hover:hidden"></div>
      </div>

      {/* Time */}
      <div className="w-full md:flex-1 px-6 py-3 cursor-pointer relative group border-b md:border-b-0 border-border transition-colors hover:bg-muted/50">
        <label className="block text-xs font-bold text-foreground mb-0.5 uppercase tracking-wide">
          Time
        </label>
        <div className="text-sm text-muted-foreground">Add time</div>
        <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-8 w-[1px] bg-border group-hover:hidden"></div>
      </div>

      {/* Guests */}
      <div className="w-full md:flex-1 px-6 py-3 cursor-pointer relative group transition-colors hover:bg-muted/50 md:rounded-r-full md:mr-2">
        <label className="block text-xs font-bold text-foreground mb-0.5 uppercase tracking-wide">
          Who
        </label>
        <div className="text-sm text-muted-foreground">Add guests</div>
      </div>

      {/* Search Button */}
      <div className="p-2 w-full md:w-auto">
        <button
          onClick={onSearch}
          className="bg-primary hover:bg-primary/90 text-white p-4 rounded-full transition-all shadow-md hover:scale-105 flex items-center justify-center gap-2 w-full md:w-auto active:scale-95"
        >
          <Search className="w-5 h-5 font-bold" />
          <span className="font-semibold px-2 md:hidden lg:inline">Search</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   STATUS / ERROR / EMPTY
   ============================================================================ */

type GuestStatusProps = {
  title: string;
  description?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: React.ElementType;
  actions?: ReactNode;
  className?: string;
  'aria-live'?: 'polite' | 'assertive';
} & ComponentPropsWithoutRef<'div'>;

const toneMap: Record<
  NonNullable<GuestStatusProps['tone']>,
  { bg: string; text: string; icon: React.ElementType }
> = {
  info: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Info },
  success: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2 },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: AlertCircle },
  danger: { bg: 'bg-red-50', text: 'text-red-700', icon: AlertCircle },
};

export const GuestStatus = forwardRef<HTMLDivElement, GuestStatusProps>(function GuestStatus(
  { title, description, tone = 'info', icon, actions, className, ...rest },
  ref,
) {
  const palette = toneMap[tone];
  const Icon = icon ?? palette.icon;
  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      className={cn(
        'flex items-start gap-4 rounded-2xl border border-border px-4 py-3',
        palette.bg,
        palette.text,
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="mt-0.5 h-5 w-5" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? <p className="text-sm opacity-90">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
});

type GuestEmptyProps = {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionProps?: React.ComponentProps<typeof Button>;
  secondaryAction?: ReactNode;
  className?: string;
};

export function GuestEmpty({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  actionHref,
  actionProps,
  secondaryAction,
  className,
}: GuestEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-3xl border border-border',
        'bg-muted/50 px-8 py-12 text-center',
        className,
      )}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-background shadow-sm border border-border text-muted-foreground">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        {actionLabel && actionHref ? (
          <Button asChild className="rounded-full px-8">
            <Link href={actionHref} {...(actionProps as object)}>
              {actionLabel}
            </Link>
          </Button>
        ) : null}
        {secondaryAction}
      </div>
    </div>
  );
}

type GuestErrorProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  redirectHref?: string;
  redirectLabel?: string;
};

export function GuestError({
  title = 'Something went wrong',
  description = 'Please try again in a moment.',
  onRetry,
  redirectHref,
  redirectLabel = 'Go back',
}: GuestErrorProps) {
  return (
    <div className="luminous-panel relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10 text-center max-w-md mx-auto">
      <div className="relative space-y-6">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-[var(--luminous-tone-danger-bg)] text-[var(--luminous-tone-danger-text)]">
          <AlertCircle className="h-8 w-8" aria-hidden />
        </div>
        <div className="space-y-2">
          <h3 className="heading-subsection">{title}</h3>
          <p className="text-body-warm luminous-copy-measure mx-auto">{description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onRetry ? (
            <Button
              onClick={onRetry}
              size="lg"
              className="luminous-cta btn-tactile min-h-[48px] rounded-[var(--luminous-radius)] px-6 text-white"
            >
              Try again
            </Button>
          ) : null}
          {redirectHref ? (
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="luminous-secondary btn-tactile min-h-[44px] rounded-[var(--luminous-radius)] px-6"
            >
              <Link href={redirectHref}>{redirectLabel}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
