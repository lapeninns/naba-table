/**
 * Direction C — "Summary sheet"  (chosen direction, refined)
 *
 * Collapsed, the bar is a single peek line + actions — the smallest possible
 * footprint, ideal at 320px. Tapping the peek expands a sheet *upward* with the
 * full booking context (labeled facts) and any support actions, without leaving
 * the step.
 *
 * Refinements over the prototype:
 *  - Facts come from a structured `facts` prop → correct labels on every step
 *    (Plan / Confirmation no longer mis-label a string array).
 *  - Desktop: peek + actions collapse onto one row, primary is auto-width, the
 *    drag handle is mobile-only (the sheet metaphor is a phone idiom).
 *  - Auto-collapses when the step changes; Escape closes; the panel is a labeled
 *    region; motion + the chevron/ring transitions respect reduced-motion.
 */
import { ChevronUp } from 'lucide-react';
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

export function WizardNavC({
  steps,
  currentStep,
  summary,
  actions,
  facts = [],
  visible = true,
  onHeightChange,
  className,
}: WizardNavVariantProps) {
  const peekRef = React.useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = React.useState(false);

  // Report the always-present peek height (not the transient expanded panel).
  useReportedHeight(peekRef, onHeightChange);

  const total = steps.length || 1;
  const current = Math.min(Math.max(currentStep, 1), total);
  const fraction = progressFraction(current, total);
  const stepLabel = steps[current - 1]?.label ?? `Step ${current}`;
  const line = summaryLine(summary);
  const canExpand = facts.length > 0;

  const { primary, secondary, support } = React.useMemo(() => groupActions(actions), [actions]);

  // Start each step collapsed.
  React.useEffect(() => setOpen(false), [current]);
  const isOpen = open && canExpand;

  const panelId = 'wizard-summary-sheet';
  const dashOffset = 100 - Math.round(fraction * 100);

  if (!visible) return null;

  const peek = (
    <>
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth="3"
            className="stroke-[color:var(--pg-bg-muted)]"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            className={cn(
              'stroke-[color:var(--pg-action)]',
              !reduced && 'transition-[stroke-dashoffset] duration-500 ease-out',
            )}
            style={{ strokeDasharray: 100, strokeDashoffset: dashOffset }}
          />
        </svg>
        <span className="absolute text-[11px] font-bold tabular-nums text-[color:var(--pg-text)]">
          {current}/{total}
        </span>
      </span>

      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate text-sm font-semibold text-[color:var(--pg-text)]">
          {stepLabel}
        </span>
        {line ? (
          <span className="truncate text-xs text-[color:var(--pg-text-muted)]">{line}</span>
        ) : null}
      </span>

      {canExpand ? (
        <ChevronUp
          className={cn(
            'ml-auto h-4 w-4 shrink-0 text-[color:var(--pg-text-muted)]',
            !reduced && 'transition-transform duration-300 ease-out',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

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
        aria-label="Booking wizard navigation"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) setOpen(false);
        }}
        className={cn(
          'pointer-events-auto mx-auto w-full backdrop-blur-xl text-[color:var(--pg-text)]',
          'pg-panel rounded-t-[var(--pg-radius-xl)] sm:max-w-3xl sm:rounded-[var(--pg-radius-xl)]',
          !reduced && 'animate-slide-up',
          isOpen && 'shadow-[var(--pg-shadow-lg)]',
        )}
      >
        {/* Mobile-only drag/expand affordance */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-[color:var(--pg-border)]" />
        </div>

        {/* Expandable sheet (grid-rows 0fr→1fr height animation) */}
        <div
          id={panelId}
          role="region"
          aria-label="Booking summary"
          className={cn(
            'grid px-4 sm:px-5',
            !reduced && 'transition-[grid-template-rows] duration-300 ease-out',
            isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 pb-3 pt-1.5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                {facts.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--pg-text-muted)]">
                      {fact.label}
                    </dt>
                    <dd className="text-sm font-semibold text-[color:var(--pg-text)]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {support.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--pg-border)] pt-3">
                  {support.map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      emphasis="secondary"
                      className="min-h-10 text-xs"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Peek + actions: stacked on mobile, single row from sm up */}
        <div
          ref={peekRef}
          className="flex flex-col gap-2.5 px-4 pb-3 pt-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:pt-2.5"
        >
          {canExpand ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="pg-focus-ring -mx-1 flex items-center gap-3 rounded-[var(--pg-radius-md)] px-1 py-1 sm:flex-1"
            >
              {peek}
            </button>
          ) : (
            <div className="-mx-1 flex items-center gap-3 px-1 py-1 sm:flex-1">{peek}</div>
          )}

          {(primary.length > 0 || secondary.length > 0) && (
            <div
              className="flex items-stretch gap-2 sm:w-auto sm:shrink-0"
              role="group"
              aria-label="Step actions"
            >
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
                  className="min-h-12 flex-1 px-6 sm:min-h-11 sm:flex-none"
                />
              ))}
            </div>
          )}
        </div>

        <div className="sr-only" aria-live="polite">
          {`Step ${current} of ${total}. ${summary.srLabel ?? summary.primary}`}
        </div>
      </nav>
    </div>
  );
}
