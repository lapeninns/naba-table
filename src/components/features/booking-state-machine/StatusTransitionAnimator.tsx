'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { OpsBookingStatus } from '@/types/ops';

const HIGHLIGHT_DURATION_MS = 900;
const CONFETTI_DURATION_MS = 950;
const DEFAULT_CONFETTI_STATUSES: OpsBookingStatus[] = ['completed'];

type StatusTransitionAnimatorProps = {
  status: OpsBookingStatus | null;
  effectiveStatus?: OpsBookingStatus | null;
  isTransitioning?: boolean;
  hasError?: boolean;
  children: ReactNode;
  className?: string;
  highlightClassName?: string;
  overlayClassName?: string;
  confettiStatuses?: OpsBookingStatus[];
};

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      setPrefersReducedMotion(false);
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return prefersReducedMotion;
}

export function StatusTransitionAnimator({
  status,
  effectiveStatus = status,
  isTransitioning = false,
  hasError = false,
  children,
  className,
  highlightClassName,
  overlayClassName,
  confettiStatuses = DEFAULT_CONFETTI_STATUSES,
}: StatusTransitionAnimatorProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const previousStatusRef = useRef<OpsBookingStatus | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const activeStatus = effectiveStatus ?? status;

  useEffect(() => {
    if (!activeStatus) {
      return;
    }
    const previous = previousStatusRef.current;
    const didChange = Boolean(previous && previous !== activeStatus);
    previousStatusRef.current = activeStatus;

    if (!didChange || prefersReducedMotion) {
      return;
    }

    setShowHighlight(true);
    const highlightTimeout = setTimeout(() => setShowHighlight(false), HIGHLIGHT_DURATION_MS);

    let confettiTimeout: ReturnType<typeof setTimeout> | null = null;
    if (confettiStatuses.includes(activeStatus)) {
      setShowConfetti(true);
      confettiTimeout = setTimeout(() => setShowConfetti(false), CONFETTI_DURATION_MS);
    }

    return () => {
      clearTimeout(highlightTimeout);
      if (confettiTimeout) clearTimeout(confettiTimeout);
    };
  }, [activeStatus, confettiStatuses, prefersReducedMotion]);

  return (
    <div
      data-transitioning={isTransitioning ? 'true' : undefined}
      data-error={hasError ? 'true' : undefined}
      className={cn(
        'relative isolate',
        isTransitioning
          ? 'opacity-90 transition-opacity duration-200'
          : 'transition-opacity duration-200',
        hasError && !prefersReducedMotion ? 'animate-[shake_340ms_ease-in-out]' : '',
        showHighlight ? cn('shadow-[0_0_0_3px_hsl(var(--primary)/0.35)]', highlightClassName) : '',
        className,
      )}
    >
      <div
        className={cn(
          overlayClassName,
          isTransitioning ? 'pointer-events-none' : null,
          'transition-transform duration-300',
          isTransitioning && !prefersReducedMotion
            ? 'motion-safe:translate-y-0 motion-safe:animate-pulse'
            : '',
        )}
      >
        {children}
      </div>
      {isTransitioning ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg border border-dashed border-primary/40 bg-primary/5"
          aria-hidden
        />
      ) : null}
      {showConfetti ? (
        <div
          aria-hidden
          data-testid="status-transition-confetti"
          className="pointer-events-none absolute inset-x-[-12px] -top-3 flex justify-center"
        >
          <div className="h-2 w-[140%] animate-[confetti-fade_0.75s_ease-out] bg-[radial-gradient(circle,_hsl(var(--primary)/0.45)_0%,_hsl(var(--primary)/0)_70%)] blur-sm" />
        </div>
      ) : null}
    </div>
  );
}

export default StatusTransitionAnimator;
