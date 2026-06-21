'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useMemo } from 'react';

import {
  buildOpsEmailDeliveryQueryString,
  getOpsEmailDeliveryTargetPath,
  type OpsEmailDeliveryQueryDefaults,
  type OpsEmailDeliveryQueryStateSnapshot,
  type OpsEmailDeliveryQuerySyncNext,
} from './opsEmailDeliveryQueryDomain';

export type UseOpsEmailDeliveryQuerySyncParams = {
  currentSearch: string;
  effectiveRestaurantId: string | null;
  pathname: string | null;
  queryDefaults: OpsEmailDeliveryQueryDefaults;
  snapshot: OpsEmailDeliveryQueryStateSnapshot;
};

export function useOpsEmailDeliveryQuerySync({
  currentSearch,
  effectiveRestaurantId,
  pathname,
  queryDefaults,
  snapshot,
}: UseOpsEmailDeliveryQuerySyncParams) {
  const router = useRouter();
  const targetPath = useMemo(() => getOpsEmailDeliveryTargetPath(pathname), [pathname]);

  return useCallback(
    (next: OpsEmailDeliveryQuerySyncNext) => {
      const nextString = buildOpsEmailDeliveryQueryString({
        current: snapshot,
        currentSearch,
        defaults: queryDefaults,
        effectiveRestaurantId,
        next,
      });

      if (nextString === currentSearch) {
        return;
      }

      startTransition(() => {
        router.replace(`${targetPath}${nextString ? `?${nextString}` : ''}`, {
          scroll: false,
        });
      });
    },
    [currentSearch, effectiveRestaurantId, queryDefaults, router, snapshot, targetPath],
  );
}
