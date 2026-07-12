/**
 * Direction B — "Progress-forward stepper"
 * Philosophy: clarify. The whole 4-step journey is always legible — a connected
 * dot stepper (done ✓ / current / upcoming) sits above the actions on EVERY
 * screen size, directly fixing the baseline's hidden-on-mobile progress. Per-dot
 * labels reveal from sm up; the current step is always named.
 */
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';

import {
  ActionButton,
  groupActions,
  summaryLine,
  useReportedHeight,
  usePrefersReducedMotion,
  type WizardNavVariantProps,
} from './shared';

export function WizardNavB({
  steps,
  currentStep,
  summary,
  actions,
  visible = true,
  onHeightChange,
  className,
}: WizardNavVariantProps) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();
  useReportedHeight(navRef, onHeightChange);

  const total = steps.length || 1;
  const current = Math.min(Math.max(currentStep, 1), total);
  const stepLabel = steps[current - 1]?.label ?? `Step ${current}`;
  const line = summaryLine(summary);

  const { primary, secondary, support } = React.useMemo(() => groupActions(actions), [actions]);

  if (!visible) return null;

  return (
    <div
      data-booking-wizard-navigation
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50',
        'pb-[env(safe-area-inset-bottom,0px)] sm:px-[var(--pg-gutter)] sm:pb-4',
        className,
      )}
    >
      <nav
        ref={navRef}
        aria-label="Booking wizard navigation"
        className={cn(
          'pointer-events-auto mx-auto flex w-full flex-col gap-3 px-4 pb-3 pt-3.5',
          'pg-panel backdrop-blur-xl text-[color:var(--pg-text)]',
          'rounded-t-[var(--pg-radius-xl)] sm:max-w-3xl sm:gap-3.5 sm:rounded-[var(--pg-radius-xl)] sm:px-5 sm:pt-4',
          !reduced && 'animate-slide-up',
        )}
      >
        {/* Stepper */}
        <ol className="flex items-center" aria-label={`Progress: step ${current} of ${total}`}>
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isDone = stepNumber < current;
            const isCurrent = stepNumber === current;
            const isLast = index === steps.length - 1;

            return (
              <li
                key={step.id ?? stepNumber}
                className={cn('flex items-center', !isLast && 'flex-1')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      'transition-colors duration-300 ease-out',
                      isDone &&
                        'bg-[color:var(--pg-action)] text-[color:var(--pg-action-contrast)]',
                      isCurrent &&
                        'bg-[color:var(--pg-action)] text-[color:var(--pg-action-contrast)] ring-4 ring-[color:var(--pg-cobalt-glow)]',
                      !isDone &&
                        !isCurrent &&
                        'bg-[color:var(--pg-bg-muted)] text-[color:var(--pg-text-muted)]',
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNumber}
                  </span>
                  {/* Per-step labels appear from sm up; the current label is always shown below */}
                  <span
                    className={cn(
                      'hidden whitespace-nowrap text-xs font-medium sm:inline',
                      isCurrent
                        ? 'text-[color:var(--pg-text)]'
                        : 'text-[color:var(--pg-text-muted)]',
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector */}
                {!isLast && (
                  <span className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-[color:var(--pg-bg-muted)]">
                    <span
                      className={cn(
                        'block h-full rounded-full bg-[color:var(--pg-action)]',
                        !reduced && 'transition-transform duration-300 ease-out',
                      )}
                      style={{
                        width: '100%',
                        transform: `scaleX(${stepNumber < current ? 1 : 0})`,
                        transformOrigin: 'left',
                      }}
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Current step + summary (label always visible, incl. mobile) */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm">
            <span className="font-semibold text-[color:var(--pg-text)]">{stepLabel}</span>
            {line ? (
              <span className="ml-2 text-xs text-[color:var(--pg-text-muted)]">{line}</span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs font-medium text-[color:var(--pg-text-muted)] tabular-nums sm:hidden">
            {current}/{total}
          </span>
        </div>

        {/* Actions */}
        {(primary.length > 0 || secondary.length > 0) && (
          <div className="flex items-stretch gap-2" role="group" aria-label="Step actions">
            {secondary.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                emphasis="secondary"
                className="flex-none px-4"
              />
            ))}
            {primary.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                emphasis="primary"
                className="min-h-12 flex-1 px-6 sm:flex-none"
              />
            ))}
          </div>
        )}

        {support.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 border-t border-[color:var(--pg-border)] pt-2">
            {support.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                emphasis="ghost"
                className="min-h-10 text-xs"
              />
            ))}
          </div>
        )}

        <div className="sr-only" aria-live="polite">
          {`Step ${current} of ${total}. ${summary.srLabel ?? summary.primary}`}
        </div>
      </nav>
    </div>
  );
}
