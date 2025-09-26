'use client';

import { useEffect, useState, type RefObject } from 'react';

export function useStickyProgress(anchorRef: RefObject<HTMLElement>) {
  const [anchorVisible, setAnchorVisible] = useState(true);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setAnchorVisible(entry.isIntersecting);
      },
      {
        threshold: 0.75,
      },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorRef]);

  return {
    isAnchorVisible: anchorVisible,
    shouldShow: true,
  } as const;
}
