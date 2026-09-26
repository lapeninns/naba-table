'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { OpsStrategicSettings } from '@/types/ops';

export type UseOpsStrategicSettingsOptions = {
  restaurantId?: string | null;
  enabled?: boolean;
};

export function useOpsStrategicSettings({
  restaurantId,
  enabled = true,
}: UseOpsStrategicSettingsOptions) {
  const bookingService = useBookingService();
  const resolvedRestaurantId = restaurantId ?? null;

  const queryKey = resolvedRestaurantId
    ? queryKeys.opsSettings.strategicConfig(resolvedRestaurantId)
    : queryKeys.opsSettings.strategicConfig('disabled');

  return useQuery<OpsStrategicSettings>({
    queryKey,
    queryFn: () => {
      if (!resolvedRestaurantId) {
        throw new Error('Restaurant must be selected before fetching strategic settings');
      }
      return bookingService.getStrategicSettings({ restaurantId: resolvedRestaurantId });
    },
    enabled: Boolean(resolvedRestaurantId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateOpsStrategicSettings() {
  const bookingService = useBookingService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingService.updateStrategicSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.opsSettings.strategicConfig(data.restaurantId), data);
    },
  });
}
