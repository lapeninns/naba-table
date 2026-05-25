'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  OpsEmailDeliveryQueryStateSnapshot,
  OpsEmailDeliverySearchDraft,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryDomain';

export type OpsEmailDeliveryQuerySnapshotPatch = Partial<OpsEmailDeliveryQueryStateSnapshot>;

export function useOpsEmailDeliveryQuerySnapshot(
  parsedSnapshot: OpsEmailDeliveryQueryStateSnapshot,
) {
  const [snapshot, setSnapshot] = useState<OpsEmailDeliveryQueryStateSnapshot>(parsedSnapshot);

  const applyQueryStateSnapshot = useCallback(
    (nextSnapshot: OpsEmailDeliveryQueryStateSnapshot) => {
      setSnapshot(nextSnapshot);
    },
    [],
  );

  const patchQueryStateSnapshot = useCallback((patch: OpsEmailDeliveryQuerySnapshotPatch) => {
    setSnapshot((current) => ({
      ...current,
      ...patch,
    }));
  }, []);

  const setSearchField = useCallback(
    (searchField: OpsEmailDeliverySearchDraft['searchField']) => {
      patchQueryStateSnapshot({ searchField });
    },
    [patchQueryStateSnapshot],
  );

  const setSearchValue = useCallback(
    (searchValue: OpsEmailDeliverySearchDraft['searchValue']) => {
      patchQueryStateSnapshot({ searchValue });
    },
    [patchQueryStateSnapshot],
  );

  useEffect(() => {
    applyQueryStateSnapshot(parsedSnapshot);
  }, [applyQueryStateSnapshot, parsedSnapshot]);

  return {
    snapshot,
    applyQueryStateSnapshot,
    patchQueryStateSnapshot,
    setSearchField,
    setSearchValue,
  };
}
