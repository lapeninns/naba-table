'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@shared/lib/cn';

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

    // triage-099: ResizeObserver is unavailable in some legacy/SSR environments; the initial
    // measurement above already reported the height, so skip observation rather than throwing.
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

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
  const variant = action.variant ?? (isPrimary ? 'default' : isSecondary ? 'outline' : 'ghost');

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
        // Base: 44px height on mobile, 48px on desktop
        'pg-action pg-focus-ring h-11 min-w-[7.25rem] flex-none rounded-full sm:h-12',
        // Typography - responsive sizing (smaller on mobile to fit)
        'text-xs font-semibold sm:text-sm',
        // GPU-accelerated transitions (transform + opacity only)
        'transition-transform duration-200 ease-out',
        // Role-specific styling
        isPrimary && [
          'px-3 sm:px-6',
          // Micro-interaction: scale on hover/press
          'hover:scale-[1.02] active:scale-[0.98]',
        ],
        isSecondary && [
          'px-2 sm:px-5',
          // Subtle border emphasis on hover
          'hover:border-primary/50',
        ],
        isSupport && ['flex-none px-3 h-9 text-xs font-medium'],
        // Override width if explicitly set
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
  // Fixed positioning at bottom
  'fixed inset-x-0 bottom-0 z-50',
  // Safe area padding for notched devices
  'pb-[env(safe-area-inset-bottom,0px)]',
  // Mobile: No horizontal padding (edge-to-edge)
  // Desktop: Horizontal padding + bottom margin for floating effect
  'px-0 sm:px-[var(--pg-gutter)]',
  'sm:pb-4',
  // Guest drawer state hides this fixed bar with compositor-only properties.
  'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
  // Pointer events pass through (nav re-enables them)
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
  // Re-enable pointer events
  'pointer-events-auto',
  // Centering and max-width
  'mx-auto w-full',

  'pg-panel backdrop-blur-xl',
  // Reserve the settled summary + action height so the fixed bar does not grow after hydration.
  'min-h-[5.375rem] sm:min-h-[6.125rem]',

  // ─── SHAPE ───────────────────────────────────────────────────────────────
  // Mobile: Attached to viewport bottom, rounded top corners
  'rounded-t-[var(--pg-radius-lg)]',
  // Desktop: Floating capsule with graceful rounding
  // Using rounded-3xl (24px) instead of rounded-full to prevent
  // "stretched pill" appearance on wide screens
  'sm:max-w-4xl sm:rounded-[var(--pg-radius-lg)]',

  // ─── TEXT ────────────────────────────────────────────────────────────────
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
    <div data-booking-wizard-navigation className={cn(OUTER_CONTAINER_CLASSES, className)}>
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
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-5 sm:py-3">
          {/* ─────────────────────────────────────────────────────────────────
              TOP: Centered Booking Summary
          ───────────────────────────────────────────────────────────────── */}
          <p
            className={cn(
              'min-h-4 text-center text-xs text-muted-foreground',
              !(summary.details && summary.details.length >= 3) && 'invisible',
            )}
            aria-hidden={!(summary.details && summary.details.length >= 3)}
          >
            {summary.details && summary.details.length >= 3 ? (
              <>
                <span className="font-medium text-foreground">{summary.details[0]}</span>
                {' at '}
                <span className="font-medium text-foreground">{summary.details[1]}</span>
                {' on '}
                <span className="font-medium text-foreground">{summary.details[2]}</span>
              </>
            ) : (
              'Selection summary'
            )}
          </p>

          {/* ─────────────────────────────────────────────────────────────────
              MIDDLE/BOTTOM: Progress + Buttons
              Mobile: Compact inline controls
              Desktop: Inline with full progress treatment
          ───────────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Progress indicator with progress bar */}
            <WizardProgress
              steps={steps}
              currentStep={currentStep}
              summary={summary}
              className="min-w-0 flex-1 [&_[role=progressbar]]:hidden [&_.tabular-nums]:hidden sm:[&_[role=progressbar]]:block sm:[&_.tabular-nums]:inline"
            />

            {/* Action Buttons */}
            {hasActions && (
              <div
                className="flex w-auto shrink-0 items-stretch gap-2"
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
          <div className="border-t border-dashed border-border/40 px-4 py-2">
            <div
              className="flex flex-wrap justify-center gap-2"
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
