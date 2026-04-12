'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@shared/lib/cn';
import { Button } from '@shared/ui/button';

import { wizardIconMap } from './wizardIcons';
import { WizardProgress, type WizardStepMeta, type WizardSummary } from './WizardProgress';
import { groupActions } from '../utils/groupActions';

import type { StepAction } from '../model/reducer';
import type { ActionRole } from '../utils/groupActions';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WizardNavigationProps {
  /** Step metadata for progress indicator */
  steps: WizardStepMeta[];
  /** Current active step number (1-indexed) */
  currentStep: number;
  /** Summary content to display */
  summary: WizardSummary;
  /** Actions available for the current step */
  actions: StepAction[];
  /** Whether the navigation is visible (default: true) */
  visible?: boolean;
  /** Callback when the nav height changes (for scroll padding) */
  onHeightChange?: (height: number) => void;
  /** Additional CSS classes */
  className?: string;
}

interface ActionButtonProps {
  action: StepAction;
  role: ActionRole;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tracks element height via ResizeObserver and reports changes.
 * Used to dynamically adjust scroll padding when the nav resizes.
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

    const updateHeight = () => {
      const height = node.getBoundingClientRect().height;
      onHeightChange(height);
    };

    // Initial measurement
    updateHeight();

    // Observe for size changes (content, font loading, etc.)
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [ref, visible, onHeightChange]);
}

/**
 * Detects user's motion preference for accessibility.
 * Returns true if user prefers reduced motion.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Individual action button with role-based styling.
 * Memoized to prevent unnecessary re-renders.
 *
 * Touch targets: 48px height (exceeds WCAG 2.1 44px minimum)
 * Shape: Pill (rounded-full) for modern aesthetic
 */
const ActionButton = React.memo(function ActionButton({ action, role }: ActionButtonProps) {
  const IconComponent = action.icon ? (wizardIconMap[action.icon] ?? null) : null;
  const isPrimary = role === 'primary';
  const isSecondary = role === 'secondary';
  const isSupport = role === 'support';
  const isLoading = action.loading;
  const isDisabled = action.disabled || isLoading;

  // Determine button variant based on action config or role
  const variant = action.variant ?? (isPrimary ? 'default' : isSecondary ? 'secondary' : 'ghost');

  // Build accessible label (fallback chain)
  const accessibleLabel = action.ariaLabel ?? action.srLabel ?? action.label;

  return (
    <Button
      variant={variant}
      size="lg"
      onClick={action.onClick}
      disabled={isDisabled}
      aria-label={accessibleLabel}
      aria-busy={isLoading}
      data-testid={`wizard-action-${action.id}`}
      className={cn(
        'flex-1 h-11 rounded-[var(--luminous-radius)] sm:flex-none sm:h-12',
        'text-xs font-semibold sm:text-sm',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'transition-all duration-200 ease-out',
        isPrimary && [
          'luminous-cta px-3 text-white sm:px-6',
          'hover:scale-[1.02] active:scale-[0.98]',
        ],
        isSecondary && ['luminous-secondary px-2 sm:px-5'],
        isSupport && ['luminous-ghost flex-none px-3 h-9 text-xs font-medium'],
        action.fullWidth === false && 'flex-none w-auto',
      )}
    >
      {/* Icon or Loading Spinner */}
      {isLoading ? (
        <Loader2
          className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin sm:mr-2 sm:h-4 sm:w-4"
          aria-hidden="true"
        />
      ) : IconComponent ? (
        <IconComponent
          className="mr-1.5 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4"
          aria-hidden="true"
        />
      ) : null}

      {/* Label - no truncate, uses responsive font size */}
      <span className="whitespace-nowrap">{action.label}</span>
    </Button>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Outer fixed container.
 *
 * Responsibilities:
 * - Fixed positioning at viewport bottom
 * - Safe area insets for notched devices (iPhone X+)
 * - Horizontal padding that scales with viewport
 * - Pointer-events passthrough to content below
 *
 * Desktop: Adds bottom padding for floating effect
 */
const OUTER_CONTAINER_CLASSES = cn(
  'fixed inset-x-0 bottom-0 z-50',
  'pb-[env(safe-area-inset-bottom,0px)]',
  'px-4 sm:px-5 lg:px-6',
  'sm:pb-4',
  'pointer-events-none',
);

/**
 * Inner nav capsule.
 *
 * Implements glassmorphism with:
 * - Semi-transparent background
 * - Backdrop blur (hardware-accelerated)
 * - Subtle border for definition
 * - Prominent shadow for floating effect
 *
 * Shape:
 * - Mobile: Rounded top corners, attached to bottom
 * - Desktop: Full pill shape, floating
 */
const NAV_CAPSULE_CLASSES = cn(
  'pointer-events-auto',
  'mx-auto w-full',
  'luminous-glass',
  'rounded-[var(--luminous-radius-panel)]',
  'sm:max-w-6xl',
  'text-foreground',
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function WizardNavigation({
  steps,
  currentStep,
  summary,
  actions,
  visible = true,
  onHeightChange,
  className,
}: WizardNavigationProps) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Track height for parent scroll padding
  useHeightObserver(navRef, visible, onHeightChange);

  // Memoize action grouping to prevent recalculation
  const groupedActions = React.useMemo(() => groupActions(actions), [actions]);
  const { primary, secondary, support } = groupedActions;

  // Early return if not visible
  if (!visible) {
    return null;
  }

  // Check if we have any actions to display
  const hasActions = primary.length > 0 || secondary.length > 0;
  const hasSupport = support.length > 0;

  return (
    <div className={cn(OUTER_CONTAINER_CLASSES, className)}>
      <nav
        ref={navRef}
        role="navigation"
        aria-label="Booking wizard navigation"
        className={cn(
          NAV_CAPSULE_CLASSES,
          // Entry animation (respects reduced motion preference)
          !prefersReducedMotion && 'animate-slide-up',
        )}
      >
        {/* ═══════════════════════════════════════════════════════════════════
            CONTENT CONTAINER
            Mobile: Stacked layout (summary, progress, buttons)
            Desktop: Summary on top, progress + buttons inline below
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
          {/* ─────────────────────────────────────────────────────────────────
              TOP: Centered Booking Summary
          ───────────────────────────────────────────────────────────────── */}
          {summary.details && summary.details.length >= 3 && (
            <div className="luminous-card-soft rounded-[calc(var(--luminous-radius)+4px)] px-4 py-3">
              <p className="text-center text-xs leading-5 text-muted-foreground sm:text-sm">
                <span className="font-semibold text-foreground">{summary.details[0]}</span>
                {' · '}
                <span className="font-semibold text-foreground">{summary.details[1]}</span>
                {' · '}
                <span className="font-semibold text-foreground">{summary.details[2]}</span>
              </p>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              MIDDLE/BOTTOM: Progress + Buttons
              Mobile: Stacked (progress row, then buttons row)
              Desktop: Inline (progress expands, buttons on right)
          ───────────────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Progress indicator with progress bar */}
            <WizardProgress
              steps={steps}
              currentStep={currentStep}
              summary={summary}
              className="luminous-card min-w-0 flex-1 rounded-[calc(var(--luminous-radius)+4px)] px-4 py-3"
            />

            {/* Action Buttons - fill width equally on mobile */}
            {hasActions && (
              <div
                className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-[16rem] sm:shrink-0"
                role="group"
                aria-label="Step actions"
              >
                {/* Secondary Actions */}
                {secondary.map((action) => (
                  <ActionButton key={action.id} action={action} role="secondary" />
                ))}

                {/* Primary Actions */}
                {primary.map((action) => (
                  <ActionButton key={action.id} action={action} role="primary" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            SUPPORT ACTIONS ROW (Optional)
            Only rendered if there are support-level actions (rare)
        ───────────────────────────────────────────────────────────────── */}
        {hasSupport && (
          <div className="px-4 pb-3">
            <div
              className="luminous-card-soft flex flex-wrap justify-center gap-2 rounded-[calc(var(--luminous-radius)+2px)] px-3 py-2"
              role="group"
              aria-label="Additional actions"
            >
              {support.map((action) => (
                <ActionButton key={action.id} action={action} role="support" />
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
