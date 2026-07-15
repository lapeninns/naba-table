'use client';

import React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@shared/lib/cn';

import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type WizardSurface = 'guest' | 'ops';

const WizardSurfaceContext = React.createContext<WizardSurface>('guest');

type WizardPanelProps = ComponentPropsWithoutRef<typeof Card> & {
  interactive?: boolean;
  surface?: WizardSurface;
};

type WizardPanelHeaderProps = ComponentPropsWithoutRef<typeof CardHeader> & {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
};

type WizardSurfaceProviderProps = {
  surface: WizardSurface;
  children: ReactNode;
};

export function WizardSurfaceProvider({ surface, children }: WizardSurfaceProviderProps) {
  return <WizardSurfaceContext.Provider value={surface}>{children}</WizardSurfaceContext.Provider>;
}

function useWizardSurface(surface?: WizardSurface) {
  const inheritedSurface = React.useContext(WizardSurfaceContext);
  return surface ?? inheritedSurface;
}

export function WizardPanel({
  children,
  className,
  interactive = false,
  surface,
  ...props
}: WizardPanelProps) {
  const resolvedSurface = useWizardSurface(surface);

  return (
    <WizardSurfaceContext.Provider value={resolvedSurface}>
      <Card
        role="group"
        data-slot="wizard-panel"
        data-surface={resolvedSurface}
        className={cn(
          'rounded-none border-x-0 border-y border-border/70 bg-transparent shadow-none transition-colors duration-200',
          interactive && 'focus-within:border-primary/35 focus-within:bg-background/45',
          className,
        )}
        {...props}
      >
        {children}
      </Card>
    </WizardSurfaceContext.Provider>
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
  const surface = useWizardSurface();
  const isOpsSurface = surface === 'ops';

  return (
    <CardHeader
      data-slot="wizard-panel-header"
      data-surface={surface}
      className={cn(
        'flex flex-col gap-3 border-b border-border/60 bg-transparent sm:flex-row sm:items-start sm:justify-between',
        isOpsSurface ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="pg-kicker text-[0.68rem]">{eyebrow}</p> : null}
          {title ? (
            <CardTitle role="heading" aria-level={3} className="text-base font-semibold">
              {title}
            </CardTitle>
          ) : null}
          {description ? (
            <CardDescription className="pg-caption max-w-[52ch]">{description}</CardDescription>
          ) : null}
          {children}
        </div>
      </div>
      {actions ? (
        <div
          data-slot="wizard-panel-actions"
          className="flex shrink-0 flex-wrap items-center gap-2 [&_a]:min-h-11 [&_button]:min-h-11"
        >
          {actions}
        </div>
      ) : null}
    </CardHeader>
  );
}

export function WizardPanelContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CardContent>) {
  const surface = useWizardSurface();
  return (
    <CardContent
      data-slot="wizard-panel-content"
      data-surface={surface}
      className={cn(surface === 'ops' ? 'p-3 sm:p-4' : 'p-4 sm:p-5', className)}
      {...props}
    />
  );
}

export function WizardPanelFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CardFooter>) {
  const surface = useWizardSurface();
  return (
    <CardFooter
      data-slot="wizard-panel-footer"
      data-surface={surface}
      className={cn(
        'flex flex-wrap items-center gap-3 border-t border-border/60',
        surface === 'ops' ? 'p-3 sm:p-4' : 'p-4 sm:p-5',
        className,
      )}
      {...props}
    />
  );
}
