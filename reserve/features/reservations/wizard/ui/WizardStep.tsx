'use client';

import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';

import { useWizardContext } from './WizardContainer';

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STEP_CONTAINER_CLASSES = cn('mx-auto w-full', 'pg-appear');

const CARD_CLASSES = cn(
  'pg-card',
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
    <div className="flex items-start gap-3 sm:items-center">
      {/* Icon */}
      {icon && (
        <span
          className={cn(
            'shrink-0 text-primary',
            'flex h-9 w-9 items-center justify-center',
            'rounded-lg bg-primary/10',
            'sm:h-10 sm:w-10',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}

      {/* Title + Description */}
      <div className="min-w-0 flex-1">
        <CardTitle id={titleId} role="heading" aria-level={2} className="pg-card-title">
          {title}
        </CardTitle>

        {description && (
          <CardDescription className="pg-caption mt-1">{description}</CardDescription>
        )}
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
}: WizardStepProps) {
  const { currentStep } = useWizardContext();
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
      node.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isActive]);

  return (
    <section
      aria-labelledby={titleId}
      data-step={step}
      data-state={isActive ? 'active' : 'inactive'}
      className={STEP_CONTAINER_CLASSES}
    >
      <Card ref={stepRef} tabIndex={-1} className={cn(CARD_CLASSES, className)}>
        {/* Header: Title + Description (no progress - it's in the nav bar) */}
        <CardHeader className="px-4 py-4 sm:px-6 sm:py-5">
          <TitleSection titleId={titleId} title={title} description={description} icon={icon} />
        </CardHeader>

        {/* Content Area */}
        <CardContent
          className={cn('space-y-4 px-4 pb-5', 'sm:space-y-5 sm:px-6 sm:pb-6', contentClassName)}
        >
          {children}
        </CardContent>
      </Card>
    </section>
  );
}
