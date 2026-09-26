'use client';

import { useEffect, useState } from 'react';

/** Distance below the top of the scroll area at which a section counts as the current one. */
const ACTIVATION_OFFSET_PX = 96;
/** Slack past a section's scroll margin, so a jump that parks it there always activates it. */
const SCROLL_MARGIN_SLACK_PX = 8;
/** Announced when a jump link scrolls to a section; the spy trusts it over scroll position. */
const SECTION_JUMP_EVENT = 'settings-section-jump';
/** Input that means the staff member is scrolling by hand again. */
const MANUAL_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;

/** Tells mounted section spies which section a jump link just scrolled to. */
export function announceSettingsSectionJump(targetId: string) {
  window.dispatchEvent(new CustomEvent<string>(SECTION_JUMP_EVENT, { detail: targetId }));
}

/** The section a staff member is reading, for the jump bar's `aria-current`. */
export function pickSectionInView(
  sections: ReadonlyArray<{ id: string; top: number; scrollMarginTop?: number }>,
  containerTop: number,
  { atEnd = false }: { atEnd?: boolean } = {},
): string | null {
  // The last section may be too short to ever reach the top; at the end of the page it is current.
  if (atEnd && sections.length > 0) {
    return sections[sections.length - 1]?.id ?? null;
  }
  let current: string | null = sections[0]?.id ?? null;
  for (const section of sections) {
    const threshold = Math.max(
      ACTIVATION_OFFSET_PX,
      (section.scrollMarginTop ?? 0) + SCROLL_MARGIN_SLACK_PX,
    );
    if (section.top - containerTop <= threshold) {
      current = section.id;
    }
  }
  return current;
}

function isScrolledToEnd(container: HTMLElement | null): boolean {
  const scroller = container ?? document.scrollingElement ?? document.documentElement;
  const { scrollTop, scrollHeight, clientHeight } = scroller;
  // A page that does not scroll has no "end" to reach.
  return (
    scrollTop > 0 && scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 2
  );
}

/**
 * Tracks which page section is at the top of the settings scroll area (`#ops-content`, or the
 * window when a page renders outside the settings shell). After a jump link is used, the
 * jumped-to section stays current until the staff member scrolls by hand.
 */
export function useSettingsSectionSpy(sectionIds: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);
  const signature = sectionIds.join('|');

  useEffect(() => {
    const ids = signature ? signature.split('|') : [];
    const container = document.getElementById('ops-content');
    const scrollTarget: HTMLElement | Window = container ?? window;
    let frame = 0;
    let jumpedId: string | null = null;

    const update = () => {
      frame = 0;
      if (jumpedId) {
        return;
      }
      const containerTop = container ? container.getBoundingClientRect().top : 0;
      const sections = ids.flatMap((id) => {
        const element = document.getElementById(id);
        if (!element || element.hidden) {
          return [];
        }
        const scrollMarginTop = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop);
        return [
          {
            id,
            top: element.getBoundingClientRect().top,
            scrollMarginTop: Number.isFinite(scrollMarginTop) ? scrollMarginTop : 0,
          },
        ];
      });
      setActiveId(pickSectionInView(sections, containerTop, { atEnd: isScrolledToEnd(container) }));
    };
    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };
    const onJump = (event: Event) => {
      const targetId = (event as CustomEvent<string>).detail;
      if (ids.includes(targetId)) {
        jumpedId = targetId;
        setActiveId(targetId);
      }
    };
    const onManualScroll = () => {
      if (jumpedId) {
        jumpedId = null;
        onScroll();
      }
    };

    update();
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener(SECTION_JUMP_EVENT, onJump);
    for (const type of MANUAL_SCROLL_EVENTS) {
      window.addEventListener(type, onManualScroll, { passive: true });
    }
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener(SECTION_JUMP_EVENT, onJump);
      for (const type of MANUAL_SCROLL_EVENTS) {
        window.removeEventListener(type, onManualScroll);
      }
    };
  }, [signature]);

  return activeId;
}
