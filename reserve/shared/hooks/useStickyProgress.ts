'use client';

import { useEffect, useState, type MutableRefObject, type RefObject } from 'react';

type RefLike<TElement extends HTMLElement> =
  | RefObject<TElement | null>
  | MutableRefObject<TElement | null>;

export function useStickyProgress<TElement extends HTMLElement>(anchorRef: RefLike<TElement>) {
  const [anchorVisible, setAnchorVisible] = useState(true);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setAnchorVisible(entry.isIntersecting);
        }
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
