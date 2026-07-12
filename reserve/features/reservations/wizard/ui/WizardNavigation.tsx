'use client';

import { ChevronUp, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@shared/lib/cn';

import { wizardIconMap } from './wizardIcons';
import { groupActions } from '../utils/groupActions';

import type { WizardStepMeta, WizardSummary } from './WizardProgress';
import type { StepAction } from '../model/reducer';
import type { ActionRole } from '../utils/groupActions';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WizardNavigationProps {
  /** Step metadata for the progress indicator */
  steps: WizardStepMeta[];
  /** Current active step number (1-indexed) */
  currentStep: number;
  /** Summary content (primary line, details, and labeled facts) */
  summary: WizardSummary;
  /** Actions available for the current step */
  actions: StepAction[];
  /** Whether the navigation is visible (default: true) */
  visible?: boolean;
  /** Callback when the collapsed nav height changes (for scroll padding) */
  onHeightChange?: (height: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Jump back to a completed step (wayfinding). Omit to make steps inert (e.g. after confirmation). */
  onStepSelect?: (step: number) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tracks an element's height via ResizeObserver and reports changes so the page
 * can pad its scroll region. Takes an initial measurement even where
 * ResizeObserver is unavailable (legacy/SSR).
 */
function useHeightObserver(
  ref: React.RefObject<HTMLElement | null>,
  visible: boolean,
  onHeightChange?: (height: number) => void,
) {
  React.useLayoutEffect(() => {
    if (!onHeightChange) return;

    const node = ref.current;
    if (!node || !visible) {
      onHeightChange(0);
      return;
    }

    const updateHeight = () => onHeightChange(node.getBoundingClientRect().height);
    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [ref, visible, onHeightChange]);
}

/** Detects the user's reduced-motion preference. */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION BUTTON (shared shadcn primitive — guest-* variants)
// ═══════════════════════════════════════════════════════════════════════════════

const VARIANT_BY_ROLE: Record<ActionRole, 'guest-primary' | 'guest-outline' | 'guest-ghost'> = {
  primary: 'guest-primary',
  secondary: 'guest-outline',
  support: 'guest-ghost',
};

function ActionButton({ action, role }: { action: StepAction; role: ActionRole }) {
  const Icon = action.icon ? (wizardIconMap[action.icon] ?? null) : null;
  const isLoading = !!action.loading;
  const isDisabled = !!action.disabled || isLoading;
  const accessibleLabel = action.ariaLabel ?? action.srLabel ?? action.label;

  return (
    <Button
      type="button"
      variant={VARIANT_BY_ROLE[role]}
      size={role === 'support' ? 'guest-sm' : 'guest-lg'}
      onClick={action.onClick}
      disabled={isDisabled}
      aria-label={accessibleLabel}
      aria-busy={isLoading}
      data-testid={`wizard-action-${action.id}`}
      className={cn(
        'pg-focus-ring',
        // Primary: dominant, full-width on mobile, auto-width from sm up (min 44px).
        role === 'primary' && 'min-h-12 flex-1 px-6 sm:min-h-11 sm:flex-none',
        role === 'secondary' && 'min-h-12 flex-none px-4 sm:min-h-11',
        role === 'support' && 'min-h-10 flex-none',
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{action.label}</span>
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — "summary sheet"
// ═══════════════════════════════════════════════════════════════════════════════

const PANEL_ID = 'wizard-summary-sheet';

export function WizardNavigation({
  steps,
  currentStep,
  summary,
  actions,
  visible = true,
  onHeightChange,
  className,
  onStepSelect,
}: WizardNavigationProps) {
  const peekRef = React.useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = React.useState(false);

  // Report the always-present peek height (not the transient expanded panel).
  useHeightObserver(peekRef, visible, onHeightChange);

  const total = steps.length || 1;
  const current = Math.min(Math.max(currentStep, 1), total);
  const fraction = current / total;
  const stepLabel = steps[current - 1]?.label ?? `Step ${current}`;
  const line = (summary.details ?? []).filter(Boolean).join(' · ');
  const facts = summary.facts ?? [];
  const canExpand = facts.length > 0;

  const { primary, secondary, support } = React.useMemo(() => groupActions(actions), [actions]);

  // Every step starts collapsed.
  React.useEffect(() => setOpen(false), [current]);
  const isOpen = open && canExpand;

  if (!visible) return null;

  const hasActions = primary.length > 0 || secondary.length > 0;
  const dashOffset = 100 - Math.round(fraction * 100);

  const peekBody = (
    <>
      {/* Circular step-progress indicator */}
      <span
        className="relative flex h-9 w-9 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
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
        <span className="ml-auto flex shrink-0">
          <ChevronUp
            className={cn(
              'h-4 w-4 text-[color:var(--pg-text-muted)]',
              !reduced && 'transition-transform duration-300 ease-out',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </span>
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
        role="navigation"
        aria-label="Booking wizard navigation"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && isOpen) setOpen(false);
        }}
        className={cn(
          'pointer-events-auto mx-auto w-full backdrop-blur-xl text-[color:var(--pg-text)]',
          'pg-panel rounded-t-[var(--pg-radius-xl)] sm:max-w-3xl sm:rounded-[var(--pg-radius-xl)]',
          !reduced && 'animate-slide-up',
          isOpen && 'shadow-[var(--pg-shadow-lg)]',
        )}
      >
        {/* Mobile-only drag/expand affordance */}
        {canExpand && (
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-[color:var(--pg-border)]" />
          </div>
        )}

        {/* Expandable sheet (grid-rows 0fr→1fr height animation) */}
        {canExpand && (
          <div
            id={PANEL_ID}
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

                {/* Jump back to a completed step (preserved from the wizard-audit
                    wayfinding fix). Rendered only when a handler is supplied — so
                    steps are inert after confirmation. */}
                {onStepSelect && current > 1 && (
                  <nav
                    aria-label="Go to a previous step"
                    className="flex flex-wrap gap-1.5 border-t border-[color:var(--pg-border)] pt-3"
                  >
                    {steps.slice(0, current - 1).map((step, index) => (
                      <Button
                        key={step.id ?? index + 1}
                        type="button"
                        variant="guest-ghost"
                        size="guest-sm"
                        onClick={() => onStepSelect(index + 1)}
                        aria-label={`${step.label} (${index + 1} of ${total})`}
                        className="pg-focus-ring min-h-10 gap-2"
                      >
                        <span className="flex size-5 items-center justify-center rounded-full bg-[color:var(--pg-action)] text-[10px] font-bold text-[color:var(--pg-action-contrast)]">
                          {index + 1}
                        </span>
                        {step.label}
                      </Button>
                    ))}
                  </nav>
                )}

                {support.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--pg-border)] pt-3">
                    {support.map((action) => (
                      <ActionButton key={action.id} action={action} role="support" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Peek + actions: stacked on mobile, single row from sm up */}
        <div
          ref={peekRef}
          className="flex flex-col gap-2.5 px-4 pb-3 pt-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:pt-2.5"
        >
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={isOpen}
              aria-controls={PANEL_ID}
              aria-label={isOpen ? 'Hide booking summary' : 'Show booking summary'}
              className="pg-focus-ring -mx-1 flex h-auto w-full items-center justify-start gap-3 rounded-[var(--pg-radius-md)] px-1 py-1 font-normal sm:w-auto sm:flex-1"
            >
              {peekBody}
            </Button>
          ) : (
            <div className="-mx-1 flex items-center gap-3 px-1 py-1 sm:flex-1">{peekBody}</div>
          )}

          {hasActions && (
            <div
              className="flex items-stretch gap-2 sm:w-auto sm:shrink-0"
              role="group"
              aria-label="Step actions"
            >
              {secondary.map((action) => (
                <ActionButton key={action.id} action={action} role="secondary" />
              ))}
              {primary.map((action) => (
                <ActionButton key={action.id} action={action} role="primary" />
              ))}
            </div>
          )}
        </div>

        {/* Screen-reader step announcement */}
        <div className="sr-only" aria-live="polite">
          {`Step ${current} of ${total}. ${summary.srLabel ?? summary.primary}`}
        </div>
      </nav>
    </div>
  );
}
