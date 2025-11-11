'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';

import { useWizardContext } from './WizardContainer';

export interface WizardStepProps {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  icon?: React.ReactNode;
}

export function WizardStep({
  step,
  title,
  description,
  children,
  className,
  contentClassName,
  icon,
}: WizardStepProps) {
  const { currentStep } = useWizardContext();
  const isActive = currentStep === step;
  const stepRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    const node = stepRef.current;
    if (!node) {
      return;
    }
    node.focus();
  }, [isActive]);

  return (
    <section
      aria-labelledby={titleId}
      data-step={step}
      data-state={isActive ? 'active' : 'inactive'}
      className="mx-auto w-full max-w-4xl lg:max-w-5xl"
    >
      <Card
        ref={stepRef}
        tabIndex={-1}
        className={cn(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/60',
          className,
        )}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            {icon ? (
              <span className="text-primary" aria-hidden>
                {icon}
              </span>
            ) : null}
            <CardTitle
              id={titleId}
              role="heading"
              aria-level={2}
              className="text-[clamp(1.65rem,1.35rem+0.6vw,2.1rem)] text-foreground"
            >
              {title}
            </CardTitle>
          </div>
          {description ? (
            <CardDescription className="text-base text-muted-foreground">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className={cn('space-y-6 sm:space-y-8', contentClassName)}>
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
