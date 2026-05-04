/**
 * StaleBoundary — visual wrapper for stale-while-revalidate content regions.
 *
 * ## Purpose
 * When a React Query hook uses `placeholderData: keepPreviousData`, the content
 * body may briefly show stale data from the previous query key while the new
 * data is in flight. Wrap the **content region only** (never filters, search
 * bars, date pickers, or primary controls) in `StaleBoundary` so users get a
 * subtle visual cue without losing interactivity on the toolbar.
 *
 * ## Golden rule
 * `StaleBoundary` wraps only the main list / grid / detail body.
 * Toolbar controls, filter bars, and date pickers must stay outside.
 *
 * ## Accessibility
 * - Sets `aria-busy="true"` on the wrapper when stale.
 * - Blur effect is **disabled** when `prefers-reduced-motion` is active;
 *   opacity-only transition is used instead.
 *
 * @see docs/sdlc/react-query-swr-ux.md
 */

import { cn } from '@/lib/utils';

import type { ComponentProps } from 'react';

type StaleBoundaryProps = ComponentProps<'div'> & {
  /**
   * Whether the wrapped content is currently showing placeholder/stale data.
   * Typically derived from `isFetching && isPlaceholderData` on a React Query result.
   */
  isStale: boolean;
};

function StaleBoundary({
  isStale,
  className,
  children,
  'aria-hidden': ariaHidden,
  ...props
}: StaleBoundaryProps) {
  return (
    <div
      data-slot="stale-boundary"
      aria-busy={isStale}
      aria-hidden={isStale ? true : ariaHidden}
      inert={isStale ? true : undefined}
      className={cn(
        'transition-opacity duration-200',
        isStale && [
          'opacity-60',
          'pointer-events-none',
          // Blur provides an extra visual cue but is gated behind
          // prefers-reduced-motion to avoid discomfort for motion-sensitive users.
          'motion-safe:blur-[1px]',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { StaleBoundary };
export type { StaleBoundaryProps };
