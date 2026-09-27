'use client';

import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react';

/** Which sides of a sideways-scrolling strip hide content right now. */
export type SettingsOverflowEdges = { start: boolean; end: boolean };

export const SETTINGS_NO_OVERFLOW: SettingsOverflowEdges = { start: false, end: false };

/**
 * Items that mark the current choice in a scrolling strip: section rail links (`aria-current`),
 * Radix tab triggers (`data-state="active"`) and ARIA tabs (`aria-selected`).
 */
export const SETTINGS_ACTIVE_ITEM_SELECTOR =
  '[aria-current="page"], [aria-current="location"], [role="tab"][data-state="active"], [role="tab"][aria-selected="true"]';

export function settingsOverflowEdges(metrics: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): SettingsOverflowEdges {
  const { scrollLeft, clientWidth, scrollWidth } = metrics;
  if (scrollWidth <= clientWidth + 1) {
    return SETTINGS_NO_OVERFLOW;
  }
  return {
    start: scrollLeft > 1,
    end: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

/**
 * Scrolls `scroller` sideways just enough to show `active`, plus a gutter so it clears the edge
 * fade. Only `scrollLeft` moves: `scrollIntoView` would also scroll the settings page vertically.
 */
export function revealSettingsActiveItem(
  scroller: HTMLElement,
  active: HTMLElement,
  gutter = 24,
): void {
  const scrollerRect = scroller.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const overflowLeft = activeRect.left - scrollerRect.left;
  const overflowRight = activeRect.right - scrollerRect.right;
  if (overflowLeft < 0) {
    scroller.scrollLeft = Math.max(0, scroller.scrollLeft + overflowLeft - gutter);
  } else if (overflowRight > 0) {
    scroller.scrollLeft += overflowRight + gutter;
  }
}

function sameEdges(a: SettingsOverflowEdges, b: SettingsOverflowEdges) {
  return a.start === b.start && a.end === b.end;
}

export type UseSettingsHorizontalOverflowOptions<T extends HTMLElement> = {
  /** The element that scrolls, when the ref sits on a wrapper. Defaults to the ref'd node. */
  resolveScroller?: (node: T) => HTMLElement | null;
  /** Changes whenever the current item may have changed, e.g. the active tab value. */
  revealKey?: unknown;
  /** Selector for the current item to keep in view. */
  activeSelector?: string;
};

/**
 * Tracks sideways overflow of a navigation strip (section rail, underline tabs) so the caller can
 * show an edge fade on each side that hides items, and keeps the current item scrolled into view.
 * Re-measures on scroll, on element resize and when items or their active state change.
 */
export function useSettingsHorizontalOverflow<T extends HTMLElement>({
  resolveScroller,
  revealKey,
  activeSelector = SETTINGS_ACTIVE_ITEM_SELECTOR,
}: UseSettingsHorizontalOverflowOptions<T> = {}): {
  ref: RefCallback<T>;
  edges: SettingsOverflowEdges;
  scroller: HTMLElement | null;
} {
  const [node, setNode] = useState<T | null>(null);
  const [edges, setEdges] = useState<SettingsOverflowEdges>(SETTINGS_NO_OVERFLOW);
  const ref = useCallback<RefCallback<T>>((next) => setNode(next), []);
  const scroller = node ? (resolveScroller ? resolveScroller(node) : node) : null;

  useLayoutEffect(() => {
    if (!scroller) {
      setEdges(SETTINGS_NO_OVERFLOW);
      return;
    }
    const measure = () => {
      const next = settingsOverflowEdges({
        scrollLeft: scroller.scrollLeft,
        clientWidth: scroller.clientWidth,
        scrollWidth: scroller.scrollWidth,
      });
      setEdges((current) => (sameEdges(current, next) ? current : next));
    };
    let lastActive: HTMLElement | null = null;
    const reveal = () => {
      const active = scroller.querySelector<HTMLElement>(activeSelector);
      if (active && active !== lastActive) {
        revealSettingsActiveItem(scroller, active);
      }
      lastActive = active;
    };

    reveal();
    measure();

    scroller.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;
    resizeObserver?.observe(scroller);
    const mutationObserver =
      typeof MutationObserver === 'function'
        ? new MutationObserver(() => {
            reveal();
            measure();
          })
        : null;
    mutationObserver?.observe(scroller, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'aria-selected', 'data-state'],
    });

    return () => {
      scroller.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [activeSelector, revealKey, scroller]);

  return { ref, edges, scroller };
}
