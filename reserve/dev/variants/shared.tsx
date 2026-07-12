/**
 * Shared primitives for the WizardNavigation redesign directions.
 *
 * Every direction (A/B/C) consumes the SAME props the harness already builds
 * (steps, currentStep, summary, actions, onHeightChange) so they stay honestly
 * comparable and any one can be lifted back into the real wizard later.
 */
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';

import { wizardIconMap } from '../../features/reservations/wizard/ui/wizardIcons';
import { groupActions } from '../../features/reservations/wizard/utils/groupActions';

import type { StepAction } from '../../features/reservations/wizard/model/reducer';
import type {
  WizardStepMeta,
  WizardSummary,
} from '../../features/reservations/wizard/ui/WizardProgress';

export type { StepAction, WizardStepMeta, WizardSummary };
export { groupActions };

/** A labeled booking fact for the expandable summary (direction C). */
export interface SummaryFact {
  label: string;
  value: string;
}

export interface WizardNavVariantProps {
  steps: WizardStepMeta[];
  currentStep: number;
  summary: WizardSummary;
  actions: StepAction[];
  /** Structured booking facts for the expandable sheet. A/B/current ignore this. */
  facts?: SummaryFact[];
  visible?: boolean;
  onHeightChange?: (height: number) => void;
  className?: string;
}

// ─── hooks ───────────────────────────────────────────────────────────────────

/** Reports the measured height of `ref` to the parent for scroll padding. */
export function useReportedHeight(
  ref: React.RefObject<HTMLElement | null>,
  onHeightChange?: (height: number) => void,
) {
  React.useLayoutEffect(() => {
    if (!onHeightChange) return;
    const node = ref.current;
    if (!node) return;

    const measure = () => onHeightChange(node.getBoundingClientRect().height);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [ref, onHeightChange]);
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

export function WizardIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = name ? wizardIconMap[name] : null;
  return Cmp ? <Cmp className={className} aria-hidden="true" /> : null;
}

/** Fraction complete used for progress affordances (25% at step 1 → 100% at the end). */
export function progressFraction(currentStep: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(currentStep, 1), total) / total;
}

/** A compact "7:00 PM · 2 guests · Inside seating" line. */
export function summaryLine(summary: WizardSummary): string {
  return (summary.details ?? []).filter(Boolean).join(' · ');
}

/** Labeled rows for the expandable summary sheet (direction C). */
export function summaryRows(summary: WizardSummary): { label: string; value: string }[] {
  const [time, party, seating] = summary.details ?? [];
  return [
    { label: 'Date', value: summary.primary },
    { label: 'Time', value: time ?? '' },
    { label: 'Party', value: party ?? '' },
    { label: 'Seating', value: seating ?? '' },
  ].filter((row) => row.value);
}

// ─── buttons ─────────────────────────────────────────────────────────────────

type Emphasis = 'primary' | 'secondary' | 'ghost';

const EMPHASIS_CLASSES: Record<Emphasis, string> = {
  primary: cn(
    'bg-[var(--pg-action)] text-[var(--pg-action-contrast)] shadow-[var(--pg-shadow-button)]',
    'hover:bg-[var(--pg-action-hover)] active:translate-y-px',
  ),
  secondary: cn(
    'border border-[color:var(--pg-border)] bg-[color:var(--pg-bg)] text-[color:var(--pg-text)]',
    'hover:bg-[color:var(--pg-bg-muted)]',
  ),
  ghost: cn(
    'bg-transparent text-[color:var(--pg-action)]',
    'hover:bg-[color:color-mix(in_srgb,var(--pg-action)_10%,transparent)]',
  ),
};

/**
 * The single button used across every direction. Honors loading/disabled,
 * lucide icon, and a screen-reader label, at a WCAG-safe 44px+ target.
 */
export function ActionButton({
  action,
  emphasis,
  block = false,
  className,
}: {
  action: StepAction;
  emphasis: Emphasis;
  block?: boolean;
  className?: string;
}) {
  const isLoading = !!action.loading;
  const disabled = !!action.disabled || isLoading;
  const label = action.ariaLabel ?? action.srLabel ?? action.label;

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={disabled}
      aria-label={label}
      aria-busy={isLoading}
      data-testid={`wizard-action-${action.id}`}
      className={cn(
        'pg-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full',
        'px-5 text-sm font-semibold whitespace-nowrap',
        'transition-[background-color,transform,box-shadow] duration-200 ease-out',
        'disabled:pointer-events-none disabled:opacity-60',
        EMPHASIS_CLASSES[emphasis],
        block && 'w-full',
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <WizardIcon name={action.icon} className="h-4 w-4 shrink-0" />
      )}
      <span>{action.label}</span>
    </button>
  );
}

/** Compact square icon button (e.g. Back-as-chevron on small screens). */
export function IconButton({
  action,
  icon: Icon,
  className,
}: {
  action: StepAction;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-label={action.ariaLabel ?? action.label}
      data-testid={`wizard-action-${action.id}`}
      className={cn(
        'pg-focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
        'border border-[color:var(--pg-border)] bg-[color:var(--pg-bg)] text-[color:var(--pg-text)]',
        'transition-colors duration-200 ease-out hover:bg-[color:var(--pg-bg-muted)]',
        'disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      <Icon className="h-5 w-5" aria-hidden={true} />
    </button>
  );
}
