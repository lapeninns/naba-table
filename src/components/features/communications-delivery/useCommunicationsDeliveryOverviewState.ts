'use client';

import { useEffect, useMemo, useState } from 'react';

import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsEmailDeliverySummary } from '@/hooks/ops/useOpsEmailDeliverySummary';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsRestaurantSmsDeliveryFeed } from '@/hooks/ops/useOpsRestaurantSmsDeliveryFeed';

import type { CommunicationsDeliveryRestaurantOption } from './communicationsDeliveryTypes';
import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';

export function useCommunicationsDeliveryOverviewState(params: {
  restaurantId: string | null;
  range: OpsEmailDeliveryRange;
  onRestaurantIdChange: (restaurantId: string | null) => void;
}) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );

  const effectiveRestaurantId = useMemo(() => {
    if (params.restaurantId && membershipIds.has(params.restaurantId)) return params.restaurantId;
    if (activeRestaurantId && membershipIds.has(activeRestaurantId)) return activeRestaurantId;
    return memberships[0]?.restaurantId ?? null;
  }, [activeRestaurantId, membershipIds, memberships, params.restaurantId]);

  const [availableRestaurants, setAvailableRestaurants] = useState<
    CommunicationsDeliveryRestaurantOption[]
  >([]);

  useEffect(() => {
    if (!effectiveRestaurantId) return;
    if (effectiveRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(effectiveRestaurantId);
    }
  }, [activeRestaurantId, effectiveRestaurantId, setActiveRestaurantId]);

  useEffect(() => {
    if (effectiveRestaurantId !== params.restaurantId) {
      params.onRestaurantIdChange(effectiveRestaurantId);
    }
  }, [effectiveRestaurantId, params]);

  useEffect(() => {
    let cancelled = false;
    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          restaurants
            .filter((restaurant) => membershipIds.has(restaurant.id))
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              timezone: restaurant.timezone,
            })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(
          memberships.map((membership) => ({
            id: membership.restaurantId,
            name: membership.restaurantName,
            timezone: null,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const restaurantDetails = useOpsRestaurantDetails(effectiveRestaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const emailSummaryQuery = useOpsEmailDeliverySummary({
    restaurantId: effectiveRestaurantId,
    range: params.range,
  });

  const messageFeedQuery = useOpsRestaurantSmsDeliveryFeed({
    restaurantId: effectiveRestaurantId,
    range: params.range as '24h' | '7d' | '30d',
    page: 1,
    pageSize: 1,
    channel: 'all',
  });

  return {
    memberships,
    restaurantId: effectiveRestaurantId,
    availableRestaurants,
    restaurantDetails,
    timezone,
    emailSummaryQuery,
    messageFeedQuery,
  };
}
