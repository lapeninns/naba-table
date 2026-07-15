'use client';

import * as React from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@shared/lib/cn';

import { useWizardContext } from './WizardContainer';
import { WizardSurfaceProvider, type WizardSurface } from './WizardPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardStepProps {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  icon?: React.ReactNode;
  totalSteps?: number;
  surface?: WizardSurface;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEP_CONTAINER_CLASSES = cn('mx-auto w-full', 'pg-appear');

const CARD_CLASSES = cn(
  'rounded-[var(--pg-radius-lg)] border-border/80 bg-background/92 shadow-[var(--pg-shadow-edge)]',
  'overflow-hidden',
  'focus-visible:outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2',
);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface TitleSectionProps {
  titleId: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

function TitleSection({ titleId, title, description, icon }: TitleSectionProps) {
  return (
    <div className="flex items-start gap-3">
      {icon ? (
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--pg-radius-md)] border border-primary/15 bg-primary/10 text-primary',
          )}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <CardTitle
          id={titleId}
          role="heading"
          aria-level={2}
          className="pg-card-title text-balance"
        >
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="pg-caption mt-1 max-w-[62ch] text-pretty">
            {description}
          </CardDescription>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function WizardStep({
  step,
  title,
  description,
  children,
  className,
  contentClassName,
  icon,
  surface = 'guest',
}: WizardStepProps) {
  const { currentStep, totalSteps } = useWizardContext();
  const isActive = currentStep === step;
  const stepRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();

  // ─────────────────────────────────────────────────────────────────────────
  // Focus management on step activation
  // ─────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!isActive) {
      return;
    }
    const node = stepRef.current;
    if (!node) {
      return;
    }
    // Delay focus slightly to ensure animations complete
    const timer = setTimeout(() => {
      node.focus({ preventScroll: step === 1 });
    }, 100);
    return () => clearTimeout(timer);
  }, [isActive, step]);

  const isOpsSurface = surface === 'ops';

  return (
    <WizardSurfaceProvider surface={surface}>
      <section
        aria-labelledby={titleId}
        data-step={step}
        data-state={isActive ? 'active' : 'inactive'}
        data-surface={surface}
        className={STEP_CONTAINER_CLASSES}
      >
        <Card
          ref={stepRef}
          tabIndex={-1}
          data-slot="wizard-step-surface"
          data-surface={surface}
          className={cn(
            CARD_CLASSES,
            isActive && 'ring-1 ring-primary/30 ring-offset-2 ring-offset-background',
            className,
          )}
        >
          <CardHeader
            className={cn(
              'pg-wizard-card-header border-b border-border/70',
              isOpsSurface ? 'px-3 py-3 sm:px-4' : 'px-4 py-4 sm:px-6',
            )}
          >
            <TitleSection titleId={titleId} title={title} description={description} icon={icon} />
            {totalSteps > 1 ? (
              <p className="sr-only">
                Step {step} of {totalSteps}.
              </p>
            ) : null}
          </CardHeader>

          <CardContent
            className={cn(
              isOpsSurface
                ? 'space-y-3 px-3 pb-4 pt-3 sm:space-y-4 sm:px-4 sm:pb-5 sm:pt-4'
                : 'space-y-4 px-4 pb-5 pt-4 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7',
              contentClassName,
            )}
          >
            {children}
          </CardContent>
        </Card>
      </section>
    </WizardSurfaceProvider>
  );
}
