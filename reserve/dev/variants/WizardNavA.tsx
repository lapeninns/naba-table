/**
 * Direction A — "Action-first dock"
 * Philosophy: reduce. A quiet dock where the primary action is unmissable, a
 * hairline progress line rides the top edge, and step + summary sit as one calm
 * supporting line. Two rows on mobile; a single airy row when it floats on ≥sm.
 */
import * as React from 'react';

import { cn } from '@shared/lib/cn';

import {
  ActionButton,
  groupActions,
  progressFraction,
  summaryLine,
  useReportedHeight,
  usePrefersReducedMotion,
  type WizardNavVariantProps,
} from './shared';

export function WizardNavA({
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
  const fraction = progressFraction(current, total);
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
          'pointer-events-auto relative mx-auto w-full overflow-hidden',
          'pg-panel backdrop-blur-xl text-[color:var(--pg-text)]',
          'rounded-t-[var(--pg-radius-xl)] sm:max-w-3xl sm:rounded-[var(--pg-radius-xl)]',
          !reduced && 'animate-slide-up',
        )}
      >
        {/* Hairline progress along the very top edge */}
        <div
          className="absolute inset-x-0 top-0 h-[3px] bg-[color:var(--pg-bg-muted)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          aria-valuetext={`Step ${current} of ${total}`}
        >
          <div
            className={cn(
              'h-full rounded-r-full bg-[color:var(--pg-action)]',
              !reduced && 'transition-[width] duration-500 ease-out',
            )}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>

        <div className="flex flex-col gap-2.5 px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          {/* Calm supporting line: step + summary */}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-[color:var(--pg-text)]">
              {stepLabel}
              <span className="ml-1.5 font-normal text-[color:var(--pg-text-muted)]">
                Step {current} of {total}
              </span>
            </span>
            {line ? (
              <span className="truncate text-xs text-[color:var(--pg-text-muted)]">{line}</span>
            ) : null}
          </div>

          {/* Actions: compact secondary, dominant primary */}
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
        </div>

        {/* Support actions (e.g. Add to calendar / wallet on confirmation) */}
        {support.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 border-t border-[color:var(--pg-border)] px-4 py-2">
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
      </nav>
    </div>
  );
}
