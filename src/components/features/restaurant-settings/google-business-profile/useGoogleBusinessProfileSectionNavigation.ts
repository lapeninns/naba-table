'use client';

import { useCallback, useEffect } from 'react';

import { isGbpAnchorId, type GbpAnchorId } from './googleBusinessProfileWorkflow';

type UseGoogleBusinessProfileSectionNavigationOptions = {
  hasSyncWorkspace: boolean;
};

function scrollToGbpAnchor(anchorId: GbpAnchorId) {
  requestAnimationFrame(() => {
    document.getElementById(anchorId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

export function useGoogleBusinessProfileSectionNavigation({
  hasSyncWorkspace,
}: UseGoogleBusinessProfileSectionNavigationOptions) {
  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !isGbpAnchorId(raw)) {
        return;
      }
      if (raw === 'gbp-sync-review' && !hasSyncWorkspace) {
        return;
      }
      scrollToGbpAnchor(raw);
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [hasSyncWorkspace]);

  const selectAnchor = useCallback(
    (anchorId: GbpAnchorId) => {
      if (anchorId === 'gbp-sync-review' && !hasSyncWorkspace) {
        return;
      }
      window.history.replaceState(null, '', `#${anchorId}`);
      scrollToGbpAnchor(anchorId);
    },
    [hasSyncWorkspace],
  );

  const chooseLocationAnchor = useCallback(() => {
    selectAnchor('gbp-location');
  }, [selectAnchor]);

  return {
    chooseLocationAnchor,
    selectAnchor,
  };
}
