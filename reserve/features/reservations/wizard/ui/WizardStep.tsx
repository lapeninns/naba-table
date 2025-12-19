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

const STEP_CONTAINER_CLASSES = cn('mx-auto w-full', 'animate-fade-in');

const CARD_CLASSES = cn(
  // Subtle shadow for depth
  'shadow-lg shadow-black/5',
  // Clean border
  'border border-border/50',
  // Solid background (no glass effect for cleaner look)
  'bg-card',
  // Rounded corners
  'rounded-xl sm:rounded-2xl',
  // Focus styling
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
        <CardTitle
          id={titleId}
          role="heading"
          aria-level={2}
          className={cn(
            'text-lg font-semibold leading-tight text-foreground',
            'sm:text-xl',
            'lg:text-2xl',
          )}
        >
          {title}
        </CardTitle>

        {description && (
          <CardDescription className={cn('mt-1', 'text-sm text-muted-foreground')}>
            {description}
          </CardDescription>
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
