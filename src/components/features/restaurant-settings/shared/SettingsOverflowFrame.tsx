'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  SETTINGS_OVERFLOW_FADE_CLASS,
  SETTINGS_OVERFLOW_FADE_END_CLASS,
  SETTINGS_OVERFLOW_FADE_START_CLASS,
} from './compactSettingsClasses';
import {
  useSettingsHorizontalOverflow,
  type SettingsOverflowEdges,
} from './useSettingsHorizontalOverflow';

import type { ReactNode } from 'react';

/**
 * Edge fades with a chevron on each side of a sideways-scrolling strip that hides items. Render
 * inside a `relative` wrapper around the scroller. Decorative: the items stay reachable by
 * scrolling, swiping and arrow keys.
 */
export function SettingsOverflowFades({ edges }: { edges: SettingsOverflowEdges }) {
  return (
    <>
      {edges.start ? (
        <div
          aria-hidden
          data-slot="settings-overflow-fade"
          data-edge="start"
          className={cn(SETTINGS_OVERFLOW_FADE_CLASS, SETTINGS_OVERFLOW_FADE_START_CLASS)}
        >
          <ChevronLeft className="size-4" />
        </div>
      ) : null}
      {edges.end ? (
        <div
          aria-hidden
          data-slot="settings-overflow-fade"
          data-edge="end"
          className={cn(SETTINGS_OVERFLOW_FADE_CLASS, SETTINGS_OVERFLOW_FADE_END_CLASS)}
        >
          <ChevronRight className="size-4" />
        </div>
      ) : null}
    </>
  );
}

function firstElementChild(node: HTMLDivElement): HTMLElement | null {
  const child = node.firstElementChild;
  return child instanceof HTMLElement ? child : null;
}

export type SettingsOverflowFrameProps = {
  /** Exactly one scrolling strip, e.g. a `TabsList` with `SETTINGS_TABS_LIST_CLASS`. */
  children: ReactNode;
  className?: string;
  /** Changes when the current item changes (e.g. the active tab value), to scroll it into view. */
  revealKey?: unknown;
};

/**
 * Wraps an in-content underline `TabsList` (or any sideways-scrolling strip) so it shows an edge
 * fade on each side that hides tabs and keeps the active tab in view (RR2). Place it inside the
 * Radix `Tabs` root:
 *
 * ```tsx
 * <Tabs value={value} onValueChange={setValue}>
 *   <SettingsOverflowFrame revealKey={value}>
 *     <TabsList className={SETTINGS_TABS_LIST_CLASS}>…</TabsList>
 *   </SettingsOverflowFrame>
 * </Tabs>
 * ```
 */
export function SettingsOverflowFrame({
  children,
  className,
  revealKey,
}: SettingsOverflowFrameProps) {
  const { ref, edges } = useSettingsHorizontalOverflow<HTMLDivElement>({
    resolveScroller: firstElementChild,
    revealKey,
  });
  return (
    <div
      ref={ref}
      data-slot="settings-overflow-frame"
      data-overflow-start={edges.start || undefined}
      data-overflow-end={edges.end || undefined}
      className={cn('relative min-w-0', className)}
    >
      {children}
      <SettingsOverflowFades edges={edges} />
    </div>
  );
}
