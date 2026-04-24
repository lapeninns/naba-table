'use client';

import { AlertCircle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import React, { forwardRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';

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
  {
    variant: ComponentPropsWithoutRef<typeof Alert>['variant'];
    text: string;
    icon: React.ElementType;
  }
> = {
  info: { variant: 'info', text: 'text-primary', icon: Info },
  success: { variant: 'success', text: 'text-primary', icon: CheckCircle2 },
  warning: { variant: 'warning', text: 'text-foreground', icon: AlertCircle },
  danger: { variant: 'destructive', text: 'pg-danger-text', icon: AlertCircle },
};

export const GuestStatus = forwardRef<HTMLDivElement, GuestStatusProps>(function GuestStatus(
  { title, description, tone = 'info', icon, actions, className, ...rest },
  ref,
) {
  const palette = toneMap[tone];
  const Icon = icon ?? palette.icon;

  return (
    <Alert
      ref={ref}
      role="status"
      tabIndex={-1}
      variant={palette.variant}
      className={cn(
        'pg-panel border-border/80 shadow-[var(--pg-shadow-edge)]',
        palette.text,
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="h-5 w-5" />
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="min-w-0 flex-1">
          <AlertTitle>{title}</AlertTitle>
          {description ? <AlertDescription>{description}</AlertDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </Alert>
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
    <Card
      className={cn(
        'pg-panel border-border/80 bg-[color:color-mix(in_srgb,var(--pg-surface-raised)_88%,white)] text-center shadow-[var(--pg-shadow-edge)]',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center px-8 py-12">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[var(--pg-radius-md)] border border-border/80 bg-background text-muted-foreground shadow-[var(--pg-shadow-xs)]">
          <Icon className="h-8 w-8" aria-hidden />
        </div>
        <CardTitle className="pg-card-title">{title}</CardTitle>
        <p className="pg-body mt-2 max-w-sm">{description}</p>
        {(actionLabel && actionHref) || secondaryAction ? (
          <>
            <Separator className="my-8 max-w-xs" />
            <div className="flex flex-wrap items-center justify-center gap-4">
              {actionLabel && actionHref ? (
                <Button
                  asChild
                  variant="guest-primary"
                  size="guest-lg"
                  className="pg-action pg-focus-ring pg-touch"
                >
                  <Link href={actionHref} {...(actionProps as object)}>
                    {actionLabel}
                  </Link>
                </Button>
              ) : null}
              {secondaryAction}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
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
    <Card className="pg-panel overflow-hidden border-border/80 shadow-[var(--pg-shadow-edge)]">
      <CardHeader className="items-center gap-4 border-b border-border/70 bg-muted/35 px-6 py-5 text-center">
        <div className="pg-danger-icon flex h-12 w-12 items-center justify-center rounded-full">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </div>
        <CardTitle className="pg-card-title">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-6">
        <p className="pg-body text-center">{description}</p>
      </CardContent>
      {onRetry || redirectHref ? (
        <CardFooter className="flex flex-wrap items-center justify-center gap-4 border-t border-border/70 px-6 py-5">
          {onRetry ? (
            <Button
              onClick={onRetry}
              variant="guest-primary"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch"
            >
              Try again
            </Button>
          ) : null}
          {redirectHref ? (
            <Button
              variant="guest-outline"
              size="guest-lg"
              asChild
              className="pg-action pg-focus-ring pg-touch"
            >
              <Link href={redirectHref}>{redirectLabel}</Link>
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
