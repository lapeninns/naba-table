'use client';

import { useEffect } from 'react';

import { isGbpAnchorId } from './googleBusinessProfileWorkflow';

type UseGoogleBusinessProfileSectionNavigationOptions = {
  /** Step 3 only exists once a location is mapped, so its hash is ignored until then. */
  canReview: boolean;
  /** The steps render only once connection data has loaded. */
  ready: boolean;
};

/** Scrolls to a step when the page is opened with `#gbp-connection`, `#gbp-location` or `#gbp-sync-review`. */
export function useGoogleBusinessProfileSectionNavigation({
  canReview,
  ready,
}: UseGoogleBusinessProfileSectionNavigationOptions) {
  useEffect(() => {
    if (!ready) {
      return;
    }
    const applyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !isGbpAnchorId(raw)) {
        return;
      }
      if (raw === 'gbp-sync-review' && !canReview) {
        return;
      }
      requestAnimationFrame(() => {
        document.getElementById(raw)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [canReview, ready]);
}
