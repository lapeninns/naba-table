'use client';

import { useEffect, useState } from 'react';

/** Distance below the top of the scroll area at which a section counts as the current one. */
const ACTIVATION_OFFSET_PX = 96;

/** The section a staff member is reading, for the jump bar's `aria-current`. */
export function pickSectionInView(
  sections: ReadonlyArray<{ id: string; top: number }>,
  containerTop: number,
): string | null {
  let current: string | null = sections[0]?.id ?? null;
  for (const section of sections) {
    if (section.top - containerTop <= ACTIVATION_OFFSET_PX) {
      current = section.id;
    }
  }
  return current;
}

/**
 * Tracks which page section is at the top of the settings scroll area (`#ops-content`, or the
 * window when a page renders outside the settings shell).
 */
export function useSettingsSectionSpy(sectionIds: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null);
  const signature = sectionIds.join('|');

  useEffect(() => {
    const ids = signature ? signature.split('|') : [];
    const container = document.getElementById('ops-content');
    const scrollTarget: HTMLElement | Window = container ?? window;
    let frame = 0;

    const update = () => {
      frame = 0;
      const containerTop = container ? container.getBoundingClientRect().top : 0;
      const sections = ids.flatMap((id) => {
        const element = document.getElementById(id);
        return element && !element.hidden ? [{ id, top: element.getBoundingClientRect().top }] : [];
      });
      setActiveId(pickSectionInView(sections, containerTop));
    };
    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [signature]);

  return activeId;
}
