'use client';

import React from 'react';

import { cn } from '@shared/lib/cn';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@shared/ui/card';

import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type WizardPanelProps = ComponentPropsWithoutRef<typeof Card> & {
  interactive?: boolean;
};

type WizardPanelHeaderProps = ComponentPropsWithoutRef<typeof CardHeader> & {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
};

export function WizardPanel({
  children,
  className,
  interactive = false,
  ...props
}: WizardPanelProps) {
  return (
    <Card
      className={cn(
        'pg-panel border-border/80 bg-background/86 shadow-[var(--pg-shadow-soft)] backdrop-blur-md transition-colors duration-200',
        interactive && 'focus-within:border-primary/35 focus-within:bg-background/96',
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

export function WizardPanelHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
  children,
  ...props
}: WizardPanelHeaderProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-col gap-3 border-b border-border/70 bg-muted/35 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="pg-kicker text-[0.68rem]">{eyebrow}</p> : null}
          {title ? <CardTitle className="text-base font-semibold">{title}</CardTitle> : null}
          {description ? (
            <CardDescription className="pg-caption max-w-[52ch]">{description}</CardDescription>
          ) : null}
          {children}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </CardHeader>
  );
}

export function WizardPanelContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CardContent>) {
  return <CardContent className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function WizardPanelFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CardFooter>) {
  return (
    <CardFooter
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-border/70 p-4 sm:p-5',
        className,
      )}
      {...props}
    />
  );
}
