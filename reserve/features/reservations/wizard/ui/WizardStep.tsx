'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Badge } from '@shared/ui/badge';
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
  totalSteps?: number; // Optional: defaults to 4 if not provided
}

export function WizardStep({
  step,
  title,
  description,
  children,
  className,
  contentClassName,
  icon,
  totalSteps = 4,
}: WizardStepProps) {
  const { currentStep } = useWizardContext();
  const isActive = currentStep === step;
  const stepRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const progressId = React.useId();

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
      aria-describedby={progressId}
      data-step={step}
      data-state={isActive ? 'active' : 'inactive'}
      className="mx-auto w-full max-w-4xl lg:max-w-5xl animate-fade-in"
    >
      <Card
        ref={stepRef}
        tabIndex={-1}
        className={cn(
          'shadow-lg transition-shadow duration-300 hover:shadow-xl',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring/60',
          className,
        )}
      >
        <CardHeader className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          {/* Step Progress Indicator */}
          <div className="flex items-center justify-between gap-3">
            <Badge
              id={progressId}
              variant="outline"
              className="px-3 py-1 text-xs font-medium tracking-wide sm:text-sm"
            >
              Step {step} of {totalSteps}
            </Badge>
            <div className="flex gap-1.5" aria-label="Progress indicator">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 w-8 rounded-full transition-all duration-300 sm:w-10',
                    i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted',
                  )}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>

          {/* Title Section */}
          <div className="flex items-start gap-3 sm:items-center">
            {icon ? (
              <span className="shrink-0 text-primary" aria-hidden>
                {icon}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <CardTitle
                id={titleId}
                role="heading"
                aria-level={2}
                className="text-xl font-bold leading-tight text-foreground sm:text-2xl lg:text-[clamp(1.65rem,1.35rem+0.6vw,2.1rem)]"
              >
                {title}
              </CardTitle>
              {description ? (
                <CardDescription className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {description}
                </CardDescription>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent
          className={cn('space-y-6 px-4 pb-6 sm:px-6 sm:pb-8 sm:space-y-8', contentClassName)}
        >
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
