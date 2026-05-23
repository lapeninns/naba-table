import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildAvailableRestaurantOptions,
  buildFallbackRestaurantOptions,
  normalizeRestaurantId,
} from '@/components/features/email-delivery/opsEmailDeliveryStateDomain';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';

type UseOpsEmailDeliveryRestaurantSelectionOptions = {
  parsedRestaurantId: string | null;
  resetToDefaults: (restaurantId: string | null) => void;
};

export function useOpsEmailDeliveryRestaurantSelection({
  parsedRestaurantId,
  resetToDefaults,
}: UseOpsEmailDeliveryRestaurantSelectionOptions) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );
  const effectiveRestaurantId = useMemo(
    () =>
      normalizeRestaurantId({
        activeRestaurantId,
        membershipIds,
        memberships,
        parsedRestaurantId,
      }),
    [activeRestaurantId, membershipIds, memberships, parsedRestaurantId],
  );
  const [availableRestaurants, setAvailableRestaurants] = useState<
    Array<{ id: string; name: string; timezone?: string | null }>
  >([]);

  useEffect(() => {
    if (!parsedRestaurantId) return;
    if (!membershipIds.has(parsedRestaurantId)) return;
    if (parsedRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(parsedRestaurantId);
    }
  }, [activeRestaurantId, membershipIds, parsedRestaurantId, setActiveRestaurantId]);

  useEffect(() => {
    if (!effectiveRestaurantId) return;
    const currentRestaurantId = parsedRestaurantId;
    if (!currentRestaurantId || currentRestaurantId === effectiveRestaurantId) return;
    resetToDefaults(effectiveRestaurantId);
  }, [effectiveRestaurantId, parsedRestaurantId, resetToDefaults]);

  useEffect(() => {
    let cancelled = false;

    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          buildAvailableRestaurantOptions({
            membershipIds,
            restaurants,
          }),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(buildFallbackRestaurantOptions(memberships));
      });

    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const handleRestaurantChange = useCallback(
    (nextRestaurantId: string) => {
      if (!membershipIds.has(nextRestaurantId)) return;
      setActiveRestaurantId(nextRestaurantId);
      resetToDefaults(nextRestaurantId);
    },
    [membershipIds, resetToDefaults, setActiveRestaurantId],
  );

  return {
    availableRestaurants,
    effectiveRestaurantId,
    handleRestaurantChange,
    memberships,
  };
}

export type OpsEmailDeliveryRestaurantSelectionState = ReturnType<
  typeof useOpsEmailDeliveryRestaurantSelection
>;
