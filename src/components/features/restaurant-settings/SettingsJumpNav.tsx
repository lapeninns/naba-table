'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

export type SettingsJumpNavItem = {
  id: string;
  label: string;
};

export type SettingsJumpNavProps = {
  items: SettingsJumpNavItem[];
  ariaLabel?: string;
  className?: string;
  /**
   * Vertical offset applied to the IntersectionObserver root margin so that
   * the fixed page header does not steal the active-section signal.
   */
  topOffset?: number;
};

const DEFAULT_TOP_OFFSET = 96;

/**
 * Shared jump navigation for long settings pages.
 *
 * Desktop: sticky vertical rail. Mobile/tablet: horizontal scrolling pill strip
 * pinned just under the page shell header. An IntersectionObserver syncs the
 * active item with the section currently closest to the top of the viewport.
 */
export function SettingsJumpNav({
  items,
  ariaLabel = 'Section navigation',
  className,
  topOffset = DEFAULT_TOP_OFFSET,
}: SettingsJumpNavProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    if (itemIds.length === 0) return;
    if (typeof window === 'undefined') return;

    const elements = itemIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    let latestActive = activeId;
    const visibility = new Map<string, number>();
    elements.forEach((el) => visibility.set(el.id, 0));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }

        let bestId: string | null = null;
        let bestRatio = 0;
        for (const id of itemIds) {
          const ratio = visibility.get(id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        if (bestId && bestId !== latestActive) {
          latestActive = bestId;
          setActiveId(bestId);
        }
      },
      {
        rootMargin: `-${topOffset}px 0px -55% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeId, itemIds, topOffset]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      setActiveId(id);

      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY + rect.top - topOffset;
      window.scrollTo({ top: scrollTop, behavior: 'smooth' });

      if (typeof window.history?.replaceState === 'function') {
        window.history.replaceState(null, '', `#${id}`);
      }
    },
    [topOffset],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Mobile + tablet: horizontal pill strip */}
      <nav
        aria-label={ariaLabel}
        className={cn(
          'sticky top-2 z-20 -mx-4 overflow-x-auto border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur-sm lg:hidden',
          className,
        )}
      >
        <ul className="flex gap-2">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={(event) => handleClick(event, item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sticky vertical rail */}
      <nav
        aria-label={ariaLabel}
        className={cn(
          'hidden lg:sticky lg:top-24 lg:block lg:w-56 lg:self-start',
          className,
        )}
      >
        <ul className="space-y-1 border-l border-border/60 pl-3">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(event) => handleClick(event, item.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={cn(
                    'group -ml-px flex items-center border-l-2 py-1.5 pl-3 text-sm transition-colors',
                    isActive
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
